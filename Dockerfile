FROM node:20-alpine as prebuilder

RUN npm install -g pnpm turbo\
    && pnpm config set registry https://registry.npm.taobao.org \
    && pnpm config set SQLITE3_BINARY_SITE https://npm.taobao.org/mirrors/sqlite3

ARG PACKAGE_NAME

WORKDIR /usr/app

COPY . .

RUN turbo prune --scope="${PACKAGE_NAME}" --docker

WORKDIR /usr/app/out/full

RUN cp /usr/app/tsconfig.json ./tsconfig.json

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install

RUN turbo run build --filter ${PACKAGE_NAME}

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --filter ${PACKAGE_NAME} --offline --prod deploy webapp

FROM node:20-alpine AS runner

ENV NODE_ENV=production

COPY --from=prebuilder /usr/app/out/full/webapp/package.json /usr/app/package.json
COPY --from=prebuilder /usr/app/out/full/webapp/dist/ /usr/app/dist/
COPY --from=prebuilder /usr/app/out/full/webapp/node_modules/ /usr/app/node_modules/
EXPOSE 8000

ENTRYPOINT ["node", "/usr/app/dist/node/index.js"]

ENTRYPOINT ["node", "--security-revert=CVE-2023-46809", "/usr/app/dist/node/index.js"]