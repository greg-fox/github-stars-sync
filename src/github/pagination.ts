export function getNextPageLink(linkHeader: string | undefined): string | null {
	if (!linkHeader) {
		return null;
	}

	for (const part of linkHeader.split(',')) {
		const match = part.match(/<([^>]+)>;\s*rel="next"/);
		if (match?.[1]) {
			return match[1];
		}
	}

	return null;
}
