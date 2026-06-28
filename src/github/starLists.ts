import { graphqlRequest } from './graphql';
import type { StarListEntry, StarListMembershipMap } from '../types';

const VIEWER_LISTS_QUERY = `
query ViewerStarLists($listsAfter: String) {
  viewer {
    login
    lists(first: 100, after: $listsAfter) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        slug
        items(first: 100) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            ... on Repository {
              databaseId
            }
          }
        }
      }
    }
  }
}
`;

const LIST_ITEMS_QUERY = `
query StarListItems($listId: ID!, $itemsAfter: String) {
  node(id: $listId) {
    ... on UserList {
      items(first: 100, after: $itemsAfter) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          ... on Repository {
            databaseId
          }
        }
      }
    }
  }
}
`;

interface GraphQlPageInfo {
	hasNextPage: boolean;
	endCursor: string | null;
}

interface GraphQlRepositoryNode {
	databaseId: number | null;
}

interface GraphQlListItemsConnection {
	pageInfo: GraphQlPageInfo;
	nodes: GraphQlRepositoryNode[];
}

interface GraphQlUserListNode {
	id: string;
	name: string;
	slug: string;
	items: GraphQlListItemsConnection;
}

interface ViewerStarListsData {
	viewer: {
		login: string;
		lists: {
			pageInfo: GraphQlPageInfo;
			nodes: GraphQlUserListNode[];
		};
	};
}

interface StarListItemsData {
	node: {
		items: GraphQlListItemsConnection;
	} | null;
}

export function buildStarListUrl(login: string, slug: string): string {
	return `https://github.com/stars/${login}/lists/${slug}`;
}

function addRepoToList(
	membership: StarListMembershipMap,
	repoId: number,
	entry: StarListEntry,
): void {
	const existing = membership.get(repoId) ?? [];
	if (existing.some((item) => item.slug === entry.slug)) {
		return;
	}

	membership.set(repoId, [...existing, entry]);
}

function collectRepoIds(items: GraphQlListItemsConnection): number[] {
	return items.nodes
		.map((node) => node.databaseId)
		.filter((id): id is number => typeof id === 'number');
}

async function paginateListItems(
	token: string,
	listId: string,
	initialItems: GraphQlListItemsConnection,
	onPage: (repoIds: number[]) => void,
): Promise<void> {
	onPage(collectRepoIds(initialItems));

	let itemsAfter = initialItems.pageInfo.hasNextPage
		? initialItems.pageInfo.endCursor
		: null;

	while (itemsAfter) {
		const data = await graphqlRequest<StarListItemsData>(
			token,
			LIST_ITEMS_QUERY,
			{ listId, itemsAfter },
		);

		const items = data.node?.items;
		if (!items) {
			break;
		}

		onPage(collectRepoIds(items));
		itemsAfter = items.pageInfo.hasNextPage ? items.pageInfo.endCursor : null;
	}
}

export async function fetchStarListMembership(
	token: string,
): Promise<StarListMembershipMap> {
	const membership: StarListMembershipMap = new Map();
	let listsAfter: string | null = null;
	let hasMoreLists = true;

	while (hasMoreLists) {
		const data: ViewerStarListsData = await graphqlRequest<ViewerStarListsData>(
			token,
			VIEWER_LISTS_QUERY,
			{ listsAfter },
		);

		const login = data.viewer.login;

		for (const list of data.viewer.lists.nodes) {
			const entry: StarListEntry = {
				name: list.name,
				slug: list.slug,
				url: buildStarListUrl(login, list.slug),
			};

			await paginateListItems(token, list.id, list.items, (repoIds) => {
				for (const repoId of repoIds) {
					addRepoToList(membership, repoId, entry);
				}
			});
		}

		hasMoreLists = data.viewer.lists.pageInfo.hasNextPage;
		listsAfter = hasMoreLists ? data.viewer.lists.pageInfo.endCursor : null;
	}

	return membership;
}
