import type { GithubRepository, StarListMembershipMap } from '../types';

export function enrichRepositoriesWithStarLists(
	repositories: GithubRepository[],
	membership: StarListMembershipMap,
): GithubRepository[] {
	return repositories.map((repository) => ({
		...repository,
		starLists: membership.get(repository.id) ?? [],
	}));
}
