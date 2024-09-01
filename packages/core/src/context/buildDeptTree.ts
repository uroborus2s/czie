import type { RemoteDeptInfo } from '@wps/types-context';

export default (
  rootId: string | null,
  depts: any[],
  creatNode: (dept: any) => RemoteDeptInfo,
) => {
  const mapTrees = new Map();
  depts?.forEach((dept) => {
    let node: RemoteDeptInfo = creatNode(dept);
    if (node.deptId !== node.deptPid) {
      if (mapTrees.has(node.deptId)) {
        //  id 已经存在，则更新节点信息
        const oldNode = mapTrees.get(node.deptId);
        node = { ...node, children: oldNode.children };
      }
      mapTrees.set(node.deptId, node);
      let pNode;
      if (mapTrees.has(node.deptPid)) {
        //  查看父节点是否存在，如果存在，则更新父节点
        pNode = mapTrees.get(node.deptPid);
        if (!pNode.children) pNode.children = [];
        pNode.children.push({ ...node });
      } else {
        //  父亲节点不存在，则新建父节点
        pNode = { children: [node] };
        mapTrees.set(node.deptPid, { ...pNode });
      }
    }
  });
  let rootNode: RemoteDeptInfo | undefined;
  if (mapTrees.has(rootId)) rootNode = mapTrees.get(rootId);
  return rootNode;
};
