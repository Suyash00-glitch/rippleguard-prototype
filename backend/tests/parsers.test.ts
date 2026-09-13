import { describe, it, expect } from 'vitest';
import { NpmDependencyParser } from '../src/parsers/npm.parser.js';
import { PythonDependencyParser } from '../src/parsers/python.parser.js';
import { ParserFactory } from '../src/parsers/index.js';

describe('Dependency Parsers', () => {
  it('parses package.json correctly with direct dependencies', () => {
    const parser = new NpmDependencyParser();
    const pkgJson = JSON.stringify({
      name: 'my-test-app',
      dependencies: {
        'express': '^4.18.2',
        'lodash': '~4.17.21',
      },
      devDependencies: {
        'vitest': '3.0.0',
      },
    });

    const result = parser.parse(pkgJson, 'package.json');
    expect(result.projectName).toBe('my-test-app');
    expect(result.packages.length).toBe(3);
    expect(result.packages.every(p => p.direct_dependency)).toBe(true);
    expect(result.packages.find(p => p.name === 'express')?.version).toBe('4.18.2');
  });

  it('parses package-lock.json v3 extracting relationships and transitive dependencies', () => {
    const parser = new NpmDependencyParser();
    const lockJson = JSON.stringify({
      name: 'dag-app',
      lockfileVersion: 3,
      packages: {
        '': {
          name: 'dag-app',
          dependencies: { 'pkg-a': '1.0.0' },
        },
        'node_modules/pkg-a': {
          version: '1.0.0',
          dependencies: { 'pkg-c': '2.0.0' },
        },
        'node_modules/pkg-c': {
          version: '2.0.0',
        },
      },
    });

    const result = parser.parse(lockJson, 'package-lock.json');
    expect(result.packages.length).toBe(2);
    const pkgA = result.packages.find(p => p.name === 'pkg-a');
    const pkgC = result.packages.find(p => p.name === 'pkg-c');
    expect(pkgA?.direct_dependency).toBe(true);
    expect(pkgC?.direct_dependency).toBe(false);

    // Verify relationship recorded: pkg-a -> pkg-c
    const relAC = result.rawRelationships?.find(r => r.source === 'pkg-a' && r.target === 'pkg-c');
    expect(relAC).toBeDefined();
  });

  it('parses requirements.txt correctly', () => {
    const parser = new PythonDependencyParser();
    const reqs = `
# Comment line
requests==2.25.1
flask>=1.1.2
urllib3~=1.26.4
`;
    const result = parser.parse(reqs, 'requirements.txt');
    expect(result.ecosystem).toBe('pypi');
    expect(result.packages.length).toBe(3);
    expect(result.packages[0].name).toBe('requests');
    expect(result.packages[0].version).toBe('2.25.1');
  });

  it('ParserFactory auto-detects parser from filename', () => {
    const npmParser = ParserFactory.getParserForFile('package.json');
    expect(npmParser?.ecosystem).toBe('npm');

    const pyParser = ParserFactory.getParserForFile('requirements.txt');
    expect(pyParser?.ecosystem).toBe('pypi');

    const mavenParser = ParserFactory.getParserForFile('pom.xml');
    expect(mavenParser?.ecosystem).toBe('maven');

    const goParser = ParserFactory.getParserForFile('go.mod');
    expect(goParser?.ecosystem).toBe('golang');
  });
});
