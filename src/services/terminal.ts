import {
  createEntry,
  deleteEntry,
  listProjects,
  moveEntry,
  readFileContent,
  searchProject,
  writeFileContent,
} from './workspace';

export type TerminalLine = {
  id: string;
  kind: 'input' | 'output' | 'error';
  text: string;
};

export type TerminalCommandResult = {
  command: string;
  output: string[];
  errors: string[];
  changed: boolean;
};

function tokenizeCommand(command: string) {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;

  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if ((char === '"' || char === "'") && !quote) {
      quote = char;
      continue;
    }

    if (quote === char) {
      quote = null;
      continue;
    }

    if (/\s/.test(char) && !quote) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function isDangerousUnsupported(command: string) {
  return /\b(rm\s+-rf|sudo|su\b|format\b|wipe\b|mkfs|dd\s+if=|powershell|cmd\.exe|bash\b|sh\b)\b/i.test(command);
}

function unsupportedRuntimeMessage(command: string) {
  if (/^(npm|npx|yarn|pnpm|node|python|python3|pip|git)\b/i.test(command)) {
    return `${command} needs a real runtime backend or native bridge. RootForge blocked it instead of pretending it ran on the phone.`;
  }

  return '';
}

export async function runWorkspaceCommand(projectName: string, rawCommand: string): Promise<TerminalCommandResult> {
  const command = rawCommand.trim();
  const result: TerminalCommandResult = {
    command,
    output: [],
    errors: [],
    changed: false,
  };

  if (!command) {
    return result;
  }

  if (isDangerousUnsupported(command)) {
    result.errors.push('Blocked dangerous or shell-escape command. Use explicit workspace commands instead.');
    return result;
  }

  const runtimeMessage = unsupportedRuntimeMessage(command);
  if (runtimeMessage) {
    result.errors.push(runtimeMessage);
    return result;
  }

  const [program = '', ...args] = tokenizeCommand(command);
  const projects = await listProjects();
  const project = projects.find((item) => item.name === projectName);
  if (!project) {
    result.errors.push('Select an existing project before running workspace commands.');
    return result;
  }

  switch (program.toLowerCase()) {
    case 'help':
      result.output.push('Supported: help, pwd, ls, cat <file>, write <file> <text>, touch <file>, mkdir <folder>, rm <path>, mv <from> <to>, grep <query>');
      break;
    case 'pwd':
      result.output.push(project.path);
      break;
    case 'ls':
      result.output.push(...project.files.map((node) => `${node.type === 'folder' ? 'dir ' : 'file'} ${node.path}`));
      if (!project.files.length) {
        result.output.push('(empty project)');
      }
      break;
    case 'cat': {
      const path = args[0];
      if (!path) {
        result.errors.push('Usage: cat <file>');
        break;
      }
      result.output.push(await readFileContent(projectName, path));
      break;
    }
    case 'write': {
      const [path, ...contentParts] = args;
      if (!path || !contentParts.length) {
        result.errors.push('Usage: write <file> <text>');
        break;
      }
      await writeFileContent(projectName, path, contentParts.join(' '));
      result.output.push(`Wrote ${path}`);
      result.changed = true;
      break;
    }
    case 'touch': {
      const path = args[0];
      if (!path) {
        result.errors.push('Usage: touch <file>');
        break;
      }
      await writeFileContent(projectName, path, '');
      result.output.push(`Touched ${path}`);
      result.changed = true;
      break;
    }
    case 'mkdir': {
      const path = args[0];
      if (!path) {
        result.errors.push('Usage: mkdir <folder>');
        break;
      }
      const slash = path.lastIndexOf('/');
      await createEntry(projectName, slash === -1 ? '' : path.slice(0, slash), slash === -1 ? path : path.slice(slash + 1), 'folder');
      result.output.push(`Created folder ${path}`);
      result.changed = true;
      break;
    }
    case 'rm': {
      const path = args[0];
      if (!path) {
        result.errors.push('Usage: rm <path>');
        break;
      }
      await deleteEntry(projectName, path);
      result.output.push(`Deleted ${path}`);
      result.changed = true;
      break;
    }
    case 'mv': {
      const [from, to] = args;
      if (!from || !to) {
        result.errors.push('Usage: mv <from> <destination-folder>');
        break;
      }
      const nextPath = await moveEntry(projectName, from, to);
      result.output.push(`Moved ${from} to ${nextPath}`);
      result.changed = true;
      break;
    }
    case 'grep': {
      const query = args.join(' ');
      if (!query) {
        result.errors.push('Usage: grep <query>');
        break;
      }
      const matches = await searchProject(projectName, query);
      result.output.push(...matches.map((match) => `${match.type}: ${match.path}`));
      if (!matches.length) {
        result.output.push('No file-name matches.');
      }
      break;
    }
    default:
      result.errors.push(`Unsupported command: ${program}. Type "help" for real phone-safe commands.`);
  }

  return result;
}

export function buildTerminalLines(current: TerminalLine[], result: TerminalCommandResult) {
  const now = Date.now();
  return [
    {
      id: `${now}:input`,
      kind: 'input' as const,
      text: `$ ${result.command}`,
    },
    ...result.output.map((text, index) => ({
      id: `${now}:out:${index}`,
      kind: 'output' as const,
      text,
    })),
    ...result.errors.map((text, index) => ({
      id: `${now}:err:${index}`,
      kind: 'error' as const,
      text,
    })),
    ...current,
  ].slice(0, 80);
}
