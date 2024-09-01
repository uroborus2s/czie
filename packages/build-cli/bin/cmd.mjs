#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import cmds from '../app/index.mjs';

yargs(hideBin(process.argv)).command(cmds).version().parse();
