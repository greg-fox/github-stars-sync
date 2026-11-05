import { describe, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import type { MetadataCache, Vault } from 'obsidian';
import {
	applyRenameToRepoNotes,
	createRelocatedNoteFinder,
} from '../../src/sync/noteTracking';
import type { GithubRepository } from '../../src/types';

describe('applyRenameToRepoNotes', () => {
	const repoNotes = {
		'1': 'GitHub Stars/a.md',
		'2': 'GitHub Stars/b.md',
		'3': 'Elsewhere/c.md',
	};

	it('updates the path of a renamed note', () => {
		expect(
			applyRenameToRepoNotes(repoNotes, 'GitHub Stars/a.md', 'Archive/a2.md'),
		).toEqual({
			'1': 'Archive/a2.md',
			'2': 'GitHub Stars/b.md',
			'3': 'Elsewhere/c.md',
		});
	});

	it('updates every tracked note inside a renamed folder', () => {
		expect(applyRenameToRepoNotes(repoNotes, 'GitHub Stars', 'Stars')).toEqual({
			'1': 'Stars/a.md',
			'2': 'Stars/b.md',
			'3': 'Elsewhere/c.md',
		});
	});

	it('does not treat a folder with a shared name prefix as a parent', () => {
		expect(
			applyRenameToRepoNotes({ '1': 'GitHub Stars 2/a.md' }, 'GitHub Stars', 'X'),
		).toBeNull();
	});

	it('returns null when no tracked note is affected', () => {
		expect(applyRenameToRepoNotes(repoNotes, 'Other.md', 'Other2.md')).toBeNull();
		expect(
			applyRenameToRepoNotes(repoNotes, 'GitHub Stars/a.md', 'GitHub Stars/a.md'),
		).toBeNull();
	});

	it('does not mutate the input', () => {
		const input = { '1': 'a.md' };
		applyRenameToRepoNotes(input, 'a.md', 'b.md');
		expect(input).toEqual({ '1': 'a.md' });
	});
});

describe('createRelocatedNoteFinder', () => {
	const repository = {
		id: 99,
		html_url: 'https://github.com/owner/demo',
	} as GithubRepository;

	function setup(files: Record<string, Record<string, unknown>>) {
		const entries = Object.entries(files).map(([path, frontmatter]) => ({
			file: Object.assign(new TFile(), { path }),
			frontmatter,
		}));
		const getMarkdownFiles = vi.fn(() => entries.map((entry) => entry.file));
		const vault = { getMarkdownFiles } as unknown as Vault;
		const metadataCache = {
			getFileCache: vi.fn((file: TFile) => {
				const entry = entries.find((candidate) => candidate.file === file);
				return entry ? { frontmatter: entry.frontmatter } : null;
			}),
		} as unknown as MetadataCache;
		return { vault, metadataCache, getMarkdownFiles };
	}

	const paths = (files: TFile[]) => files.map((file) => file.path);

	it('finds a note by github_id anywhere in the vault', () => {
		const { vault, metadataCache } = setup({
			'Projects/renamed.md': { github_id: 99 },
		});

		const find = createRelocatedNoteFinder(vault, metadataCache, 'GitHub Stars');

		expect(paths(find(repository))).toEqual(['Projects/renamed.md']);
	});

	it('only trusts id and url inside the notes folder', () => {
		const { vault, metadataCache } = setup({
			'Journal/note.md': { id: 99, url: 'https://github.com/owner/demo' },
			'GitHub Stars/sub/by-id.md': { id: '99' },
			'GitHub Stars/by-url.md': { url: 'https://GitHub.com/owner/demo' },
		});

		const find = createRelocatedNoteFinder(vault, metadataCache, 'GitHub Stars');

		expect(paths(find(repository))).toEqual([
			'GitHub Stars/sub/by-id.md',
			'GitHub Stars/by-url.md',
		]);
	});

	it('builds the frontmatter index once', () => {
		const { vault, metadataCache, getMarkdownFiles } = setup({
			'a.md': { github_id: 99 },
		});

		const find = createRelocatedNoteFinder(vault, metadataCache, 'GitHub Stars');
		find(repository);
		find({ ...repository, id: 100 });

		expect(getMarkdownFiles).toHaveBeenCalledOnce();
	});

	it('finds nothing without a metadata cache', () => {
		const { vault, getMarkdownFiles } = setup({ 'a.md': { github_id: 99 } });

		const find = createRelocatedNoteFinder(vault, undefined, 'GitHub Stars');

		expect(find(repository)).toEqual([]);
		expect(getMarkdownFiles).not.toHaveBeenCalled();
	});
});
