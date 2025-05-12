/**
 * Search
 *
 * Code for searching for dex information, used by the Dex and
 * Teambuilder.
 *
 * Dependencies: battledata, search-index
 * Optional dependencies: pokedex, moves, items, abilities
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license MIT
 */

import { Dex, type ModdedDex, toID, type ID } from "./battle-dex";

export type SearchType = (
	'pokemon' | 'type' | 'tier' | 'move' | 'item' | 'ability' | 'egggroup' | 'category' | 'article'
);

export type SearchRow = (
	[SearchType, ID, number?, number?] | ['sortpokemon' | 'sortmove', ''] | ['header' | 'html', string]
);

type SearchFilter = [string, string];

/** ID, SearchType, index (if alias), offset (if offset alias) */
declare const BattleSearchIndex: [ID, SearchType, number?, number?][];
declare const BattleSearchIndexOffset: any;
declare const BattleTeambuilderTable: any;
// digimon
declare const DigimonSearchIndex: [ID, SearchType, number?, number?][];
declare const DigimonSearchIndexOffset: any;
declare const DigimonTable: any;

/**
 * Backend for search UIs.
 */
export class DexSearch {
	query = '';

	/**
	 * Dex for the mod/generation to search.
	 */
	dex: ModdedDex = Dex;

	typedSearch: BattleTypedSearch<SearchType> | null = null;

	results: SearchRow[] | null = null;
	prependResults: SearchRow[] | null = null;
	exactMatch = false;

	static typeTable = {
		pokemon: 1,
		type: 2,
		tier: 3,
		move: 4,
		item: 5,
		ability: 6,
		egggroup: 7,
		category: 8,
		article: 9,
	};
	static typeName = {
		pokemon: 'Pok\u00e9mon',
		type: 'Type',
		tier: 'Tiers',
		move: 'Moves',
		item: 'Items',
		ability: 'Abilities',
		egggroup: 'Egg group',
		category: 'Category',
		article: 'Article',
	};
	firstPokemonColumn: 'Tier' | 'Number' = 'Number';

	/**
	 * Column to sort by. Default is `null`, a smart sort determined by how good
	 * things are according to the base filters, falling back to dex number (for
	 * Pokemon) and name (for everything else).
	 */
	sortCol: string | null = null;
	reverseSort = false;

	/**
	 * Filters for the search result. Does not include the two base filters
	 * (format and species).
	 */
	filters: SearchFilter[] | null = null;

	constructor(searchType: SearchType | '' = '', formatid = '' as ID, species = '' as ID) {
		this.setType(searchType, formatid, species);
	}

	getTypedSearch(searchType: SearchType | '', format = '' as ID, speciesOrSet: ID | Dex.PokemonSet = '' as ID) {
		if (!searchType) return null;
		switch (searchType) {
		case 'pokemon': return new BattlePokemonSearch('pokemon', format, speciesOrSet);
		case 'item': return new BattleItemSearch('item', format, speciesOrSet);
		case 'move': return new BattleMoveSearch('move', format, speciesOrSet);
		case 'ability': return new BattleAbilitySearch('ability', format, speciesOrSet);
		case 'type': return new BattleTypeSearch('type', format, speciesOrSet);
		case 'category': return new BattleCategorySearch('category', format, speciesOrSet);
		}
		return null;
	}

	find(query: string) {
		query = toID(query);
		if (this.query === query && this.results) {
			return false;
		}
		this.query = query;
		if (!query) {
			this.results = this.typedSearch?.getResults(this.filters, this.sortCol, this.reverseSort) || [];
			if (!this.filters && !this.sortCol && this.prependResults) {
				this.results = [...this.prependResults, ...this.results];
			}
		} else {
			this.results = this.textSearch(query);
		}
		return true;
	}

	setType(searchType: SearchType | '', format = '' as ID, speciesOrSet: ID | Dex.PokemonSet = '' as ID) {
		// invalidate caches
		this.results = null;

		if (searchType !== this.typedSearch?.searchType) {
			this.filters = null;
			this.sortCol = null;
		}
		this.typedSearch = this.getTypedSearch(searchType, format, speciesOrSet);
		if (this.typedSearch) this.dex = this.typedSearch.dex;
	}

	capitalizeFirst(str: string) {
		return str.charAt(0).toUpperCase() + str.slice(1);
	}
	addFilter(entry: SearchFilter | SearchRow): boolean {
		if (!this.typedSearch) return false;
		let [type] = entry;
		if (this.typedSearch.searchType === 'pokemon') {
			if (type === this.sortCol) this.sortCol = null;
			if (!['type', 'move', 'ability', 'egggroup', 'tier'].includes(type)) return false;
			if (type === 'type') entry[1] = this.capitalizeFirst(entry[1]);
			if (type === 'move') entry[1] = toID(entry[1]);
			if (type === 'ability') entry[1] = this.dex.abilities.get(entry[1]).name;
			if (type === 'tier') {
				// very hardcode
				const tierTable: { [id: string]: string } = {
					uber: "Uber",
					caplc: "CAP LC",
					capnfe: "CAP NFE",
				};
				entry[1] = toID(entry[1]);
				entry[1] = tierTable[entry[1]] || entry[1].toUpperCase();
			}
			if (!this.filters) this.filters = [];
			this.results = null;
			for (const filter of this.filters) {
				if (filter[0] === type && filter[1] === entry[1]) {
					return true;
				}
			}
			this.filters.push(entry.slice(0, 2) as SearchFilter);
			return true;
		} else if (this.typedSearch.searchType === 'move') {
			if (type === this.sortCol) this.sortCol = null;
			if (!['type', 'category', 'pokemon'].includes(type)) return false;
			if (type === 'type') entry[1] = this.capitalizeFirst(entry[1]);
			if (type === 'category') entry[1] = this.capitalizeFirst(entry[1]);
			if (type === 'pokemon') entry[1] = toID(entry[1]);
			if (!this.filters) this.filters = [];
			this.filters.push(entry.slice(0, 2) as SearchFilter);
			this.results = null;
			return true;
		}
		return false;
	}

	removeFilter(entry?: SearchFilter): boolean {
		if (!this.filters) return false;
		if (entry) {
			const filterid = entry.join(':');
			let deleted: string[] | null = null;
			// delete specific filter
			for (let i = 0; i < this.filters.length; i++) {
				if (filterid === this.filters[i].join(':')) {
					deleted = this.filters[i];
					this.filters.splice(i, 1);
					break;
				}
			}
			if (!deleted) return false;
		} else {
			this.filters.pop();
		}
		if (!this.filters.length) this.filters = null;
		this.results = null;
		return true;
	}

	toggleSort(sortCol: string) {
		if (this.sortCol === sortCol) {
			if (!this.reverseSort) {
				this.reverseSort = true;
			} else {
				this.sortCol = null;
				this.reverseSort = false;
			}
		} else {
			this.sortCol = sortCol;
			this.reverseSort = false;
		}
		this.results = null;
	}

	filterLabel(filterType: string) {
		if (this.typedSearch && this.typedSearch.searchType !== filterType) {
			return 'Filter';
		}
		return null;
	}
	illegalLabel(id: ID) {
		return this.typedSearch?.illegalReasons?.[id] || null;
	}

	getTier(species: Dex.Species) {
		return this.typedSearch?.getTier(species) || '';
	}

	textSearch(query: string): SearchRow[] {
		// Nihilslave: change searchindex for big mods
		let searchIndex = BattleSearchIndex;
		let searchIndexOffset = BattleSearchIndexOffset;
		let closest = DexSearch.getClosest;
		if (this.dex.modid.includes('digimon' as ID)) {
			searchIndex = DigimonSearchIndex;
			searchIndexOffset = DigimonSearchIndexOffset;
			closest = function (query: string) {
				// binary search through the index!
				let left = 0;
				let right = searchIndex.length - 1;
				while (right > left) {
					let mid = Math.floor((right - left) / 2 + left);
					if (searchIndex[mid][0] === query && (mid === 0 || searchIndex[mid - 1][0] !== query)) {
						// that's us
						return mid;
					} else if (searchIndex[mid][0] < query) {
						left = mid + 1;
					} else {
						right = mid - 1;
					}
				}
				if (left >= searchIndex.length - 1) left = searchIndex.length - 1;
				else if (searchIndex[left + 1][0] && searchIndex[left][0] < query) left++;
				if (left && searchIndex[left - 1][0] === query) left--;
				return left;
			}
		}

		query = toID(query);

		this.exactMatch = false;
		let searchType: SearchType | '' = this.typedSearch?.searchType || '';

		// If searchType exists, we're searching mainly for results of that type.
		// We'll still search for results of other types, but those results
		// will only be used to filter results for that type.
		let searchTypeIndex = (searchType ? DexSearch.typeTable[searchType] : -1);

		/** searching for "Psychic type" will make the type come up over the move */
		let qFilterType: 'type' | '' = '';
		if (query.endsWith('type')) {
			if (query.slice(0, -4) in window.BattleTypeChart) {
				query = query.slice(0, -4);
				qFilterType = 'type';
			}
		}

		// i represents the location of the search index we're looking at
		let i = closest(query);
		this.exactMatch = (searchIndex[i][0] === query);

		// Even with output buffer buckets, we make multiple passes through
		// the search index. searchPasses is a queue of which pass we're on:
		// [passType, i, query]

		// By doing an alias pass after the normal pass, we ensure that
		// mid-word matches only display after start matches.
		let passType: SearchPassType | '' = '';
		/**
		 * pass types:
		 * * '': time to pop the next pass off the searchPasses queue
		 * * 'normal': start at i and stop when results no longer start with query
		 * * 'alias': like normal, but output aliases instead of non-alias results
		 * * 'fuzzy': start at i and stop when you have two results
		 * * 'exact': like normal, but stop at i
		 */
		type SearchPassType = 'normal' | 'alias' | 'fuzzy' | 'exact';
		/**
		 * [passType, i, query]
		 *
		 * i = index of BattleSearchIndex to start from
		 *
		 * By doing an alias pass after the normal pass, we ensure that
		 * mid-word matches only display after start matches.
		 */
		type SearchPass = [SearchPassType, number, string];
		let searchPasses: SearchPass[] = [['normal', i, query]];

		// For performance reasons, only do an alias pass if query is at
		// least 2 chars long
		if (query.length > 1) searchPasses.push(['alias', i, query]);

		// If the query matches an official alias in BattleAliases: These are
		// different from the aliases in the search index and are given
		// higher priority. We'll do a normal pass through the index with
		// the alias text before any other passes.
		let queryAlias;
		if (query in BattleAliases) {
			if (['sub', 'tr'].includes(query) || !toID(BattleAliases[query]).startsWith(query)) {
				queryAlias = toID(BattleAliases[query]);
				let aliasPassType: SearchPassType = (queryAlias === 'hiddenpower' ? 'exact' : 'normal');
				searchPasses.unshift([aliasPassType, closest(queryAlias), queryAlias]);
			}
			this.exactMatch = true;
		}

		// If there are no matches starting with query: Do a fuzzy match pass
		// Fuzzy matches will still be shown after alias matches
		if (!this.exactMatch && searchIndex[i][0].substr(0, query.length) !== query) {
			// No results start with this. Do a fuzzy match pass.
			let matchLength = query.length - 1;
			if (!i) i++;
			while (matchLength &&
				searchIndex[i][0].substr(0, matchLength) !== query.substr(0, matchLength) &&
				searchIndex[i - 1][0].substr(0, matchLength) !== query.substr(0, matchLength)) {
				matchLength--;
			}
			let matchQuery = query.substr(0, matchLength);
			while (i >= 1 && searchIndex[i - 1][0].substr(0, matchLength) === matchQuery) i--;
			searchPasses.push(['fuzzy', i, '']);
		}

		// We split the output buffers into 8 buckets.
		// Bucket 0 is usually unused, and buckets 1-7 represent
		// pokemon, types, moves, etc (see typeTable).

		// When we're done, the buffers are concatenated together to form
		// our results, with each buffer getting its own header, unlike
		// multiple-pass results, which have no header.

		// Notes:
		// - if we have a searchType, that searchType's buffer will be on top
		let bufs: SearchRow[][] = [[], [], [], [], [], [], [], [], [], []];
		let topbufIndex = -1;

		let count = 0;
		let nearMatch = false;

		/** [type, id, typeIndex] */
		let instafilter: [SearchType, ID, number] | null = null;
		let instafilterSort = [0, 1, 2, 5, 4, 3, 6, 7, 8];
		let illegal = this.typedSearch?.illegalReasons;

		// We aren't actually looping through the entirety of the searchIndex
		for (i = 0; i < searchIndex.length; i++) {
			if (!passType) {
				let searchPass = searchPasses.shift();
				if (!searchPass) break;
				passType = searchPass[0];
				i = searchPass[1];
				query = searchPass[2];
			}

			let entry = searchIndex[i];
			let id = entry[0];
			let type = entry[1];

			if (!id) break;

			if (passType === 'fuzzy') {
				// fuzzy match pass; stop after 2 results
				if (count >= 2) {
					passType = '';
					continue;
				}
				nearMatch = true;
			} else if (passType === 'exact') {
				// exact pass; stop after 1 result
				if (count >= 1) {
					passType = '';
					continue;
				}
			} else if (id.substr(0, query.length) !== query) {
				// regular pass, time to move onto our next match
				passType = '';
				continue;
			}

			if (entry.length > 2) {
				// alias entry
				if (passType !== 'alias') continue;
			} else {
				// normal entry
				if (passType === 'alias') continue;
			}

			let typeIndex = DexSearch.typeTable[type];

			// For performance, with a query length of 1, we only fill the first bucket
			if (query.length === 1 && typeIndex !== (searchType ? searchTypeIndex : 1)) continue;

			// For pokemon queries, accept types/tier/abilities/moves/eggroups as filters
			if (searchType === 'pokemon' && (typeIndex === 5 || typeIndex > 7)) continue;
			if (searchType === 'pokemon' && typeIndex === 3 && this.dex.gen < 9) continue;
			// For move queries, accept types/categories as filters
			if (searchType === 'move' && ((typeIndex !== 8 && typeIndex > 4) || typeIndex === 3)) continue;
			// For move queries in the teambuilder, don't accept pokemon as filters
			if (searchType === 'move' && illegal && typeIndex === 1) continue;
			// For ability/item queries, don't accept anything else as a filter
			if ((searchType === 'ability' || searchType === 'item') && typeIndex !== searchTypeIndex) continue;
			// Query was a type name followed 'type'; only show types
			if (qFilterType === 'type' && typeIndex !== 2) continue;
			// hardcode cases of duplicate non-consecutive aliases
			if ((id === 'megax' || id === 'megay') && 'mega'.startsWith(query)) continue;

			let matchStart = 0;
			let matchEnd = 0;
			if (passType === 'alias') {
				// alias entry
				// [aliasid, type, originalid, matchStart, originalindex]
				matchStart = entry[3]!;
				let originalIndex = entry[2]!;
				if (matchStart) {
					matchEnd = matchStart + query.length;
					matchStart += (searchIndexOffset[originalIndex][matchStart] || '0').charCodeAt(0) - 48;
					matchEnd += (searchIndexOffset[originalIndex][matchEnd - 1] || '0').charCodeAt(0) - 48;
				}
				id = searchIndex[originalIndex][0];
			} else {
				matchEnd = query.length;
				if (matchEnd) matchEnd += (searchIndexOffset[i][matchEnd - 1] || '0').charCodeAt(0) - 48;
			}

			// some aliases are substrings
			if (queryAlias === id && query !== id) continue;

			if (searchType && searchTypeIndex !== typeIndex) {
				// This is a filter, set it as an instafilter candidate
				if (!instafilter || instafilterSort[typeIndex] < instafilterSort[instafilter[2]]) {
					instafilter = [type, id, typeIndex];
				}
			}

			// show types above Arceus formes
			if (topbufIndex < 0 && searchTypeIndex < 2 && passType === 'alias' && !bufs[1].length && bufs[2].length) {
				topbufIndex = 2;
			}

			if (illegal && typeIndex === searchTypeIndex) {
				// Always show illegal results under legal results.
				// This is done by putting legal results (and the type header)
				// in bucket 0, and illegal results in the searchType's bucket.
				// searchType buckets are always on top (but under bucket 0), so
				// illegal results will be seamlessly right under legal results.
				if (!bufs[typeIndex].length && !bufs[0].length) {
					bufs[0] = [['header', DexSearch.typeName[type]]];
				}
				if (!(id in illegal)) typeIndex = 0;
			} else {
				if (!bufs[typeIndex].length) {
					bufs[typeIndex] = [['header', DexSearch.typeName[type]]];
				}
			}

			// don't match duplicate aliases
			let curBufLength = (passType === 'alias' && bufs[typeIndex].length);
			if (curBufLength && bufs[typeIndex][curBufLength - 1][1] === id) continue;

			bufs[typeIndex].push([type, id, matchStart, matchEnd]);

			count++;
		}

		let topbuf: SearchRow[] = [];
		if (nearMatch) {
			topbuf = [['html', `<em>No exact match found. The closest matches alphabetically are:</em>`]];
		}
		if (topbufIndex >= 0) {
			topbuf = topbuf.concat(bufs[topbufIndex]);
			bufs[topbufIndex] = [];
		}
		if (searchTypeIndex >= 0) {
			topbuf = topbuf.concat(bufs[0]);
			topbuf = topbuf.concat(bufs[searchTypeIndex]);
			bufs[searchTypeIndex] = [];
			bufs[0] = [];
		}

		if (instafilter && count < 20) {
			// Result count is less than 20, so we can instafilter
			bufs.push(this.instafilter(searchType, instafilter[0], instafilter[1]));
		}

		this.results = Array.prototype.concat.apply(topbuf, bufs);
		return this.results;
	}
	private instafilter(searchType: SearchType | '', fType: SearchType, fId: ID): SearchRow[] {
		let buf: SearchRow[] = [];
		let illegalBuf: SearchRow[] = [];
		let illegal = this.typedSearch?.illegalReasons;
		if (searchType === 'pokemon') {
			switch (fType) {
			case 'type':
				let type = fId.charAt(0).toUpperCase() + fId.slice(1) as Dex.TypeName;
				buf.push(['header', `${type}-type Pok\u00e9mon`]);
				for (let id in BattlePokedex) {
					if (!BattlePokedex[id].types) continue;
					if (this.dex.species.get(id).types.includes(type)) {
						(illegal && id in illegal ? illegalBuf : buf).push(['pokemon', id as ID]);
					}
				}
				break;
			case 'ability':
				// Nihilslave: idk why it uses Dex here instead of this.dex, but it's risky to change
				let ability = Dex.abilities.get(fId).name;
				buf.push(['header', `${ability} Pok\u00e9mon`]);
				for (let id in BattlePokedex) {
					if (!BattlePokedex[id].abilities) continue;
					if (Dex.hasAbility(this.dex.species.get(id), ability)) {
						(illegal && id in illegal ? illegalBuf : buf).push(['pokemon', id as ID]);
					}
				}
				break;
			}
		} else if (searchType === 'move') {
			switch (fType) {
			case 'type':
				let type = fId.charAt(0).toUpperCase() + fId.slice(1);
				buf.push(['header', `${type}-type moves`]);
				for (let id in BattleMovedex) {
					if (BattleMovedex[id].type === type) {
						(illegal && id in illegal ? illegalBuf : buf).push(['move', id as ID]);
					}
				}
				break;
			case 'category':
				let category = fId.charAt(0).toUpperCase() + fId.slice(1);
				buf.push(['header', `${category} moves`]);
				for (let id in BattleMovedex) {
					if (BattleMovedex[id].category === category) {
						(illegal && id in illegal ? illegalBuf : buf).push(['move', id as ID]);
					}
				}
				break;
			}
		}
		return [...buf, ...illegalBuf];
	}

	static getClosest(query: string) {
		// binary search through the index!
		let left = 0;
		let right = BattleSearchIndex.length - 1;
		while (right > left) {
			let mid = Math.floor((right - left) / 2 + left);
			if (BattleSearchIndex[mid][0] === query && (mid === 0 || BattleSearchIndex[mid - 1][0] !== query)) {
				// that's us
				return mid;
			} else if (BattleSearchIndex[mid][0] < query) {
				left = mid + 1;
			} else {
				right = mid - 1;
			}
		}
		if (left >= BattleSearchIndex.length - 1) left = BattleSearchIndex.length - 1;
		else if (BattleSearchIndex[left + 1][0] && BattleSearchIndex[left][0] < query) left++;
		if (left && BattleSearchIndex[left - 1][0] === query) left--;
		return left;
	}
}

abstract class BattleTypedSearch<T extends SearchType> {
	searchType: T;
	/**
	 * Dex for the mod/generation to search.
	 */
	dex: ModdedDex = Dex;
	/**
	 * Format is the first of two base filters. It constrains results to things
	 * legal in the format, and affects the default sort.
	 *
	 * This string specifically normalizes out generation number and the words
	 * "Doubles" and "Let's Go" from the name.
	 */
	formats = [''] as ID[];
	/**
	 * `species` is the second of two base filters. It constrains results to
	 * things that species can use, and affects the default sort.
	 */
	species = '' as ID;
	/**
	 * `set` is a pseudo-base filter; it has minor effects on move sorting.
	 * (Abilities/items can affect what moves are sorted as usable.)
	 */
	set: Dex.PokemonSet | null = null;

	/**
	 * Cached copy of what the results list would be with only base filters
	 * (i.e. with an empty `query` and `filters`)
	 */
	baseResults: SearchRow[] | null = null;
	/**
	 * Cached copy of all results not in `baseResults` - mostly in case a user
	 * is wondering why a specific result isn't showing up.
	 */
	baseIllegalResults: SearchRow[] | null = null;
	illegalReasons: { [id: string]: string } | null = null;
	results: SearchRow[] | null = null;

	protected readonly sortRow: SearchRow | null = null;

	constructor(searchType: T, format = '' as ID, speciesOrSet: ID | Dex.PokemonSet = '' as ID) {
		this.searchType = searchType;

		this.baseResults = null;
		this.baseIllegalResults = null;

		this.dex = Dex.mod(format);

		/**
		 * formatType and format are two piles of shit, so I removed them
		 * just use this.formats = this.dex.modid.slice() instead
		 * generally i think we should let dex handle most things
		 * since it now can be in any mods
		 */
		this.formats = this.dex.modid.slice();

		this.species = '' as ID;
		this.set = null;
		if (typeof speciesOrSet === 'string') {
			if (speciesOrSet) this.species = speciesOrSet;
		} else {
			this.set = speciesOrSet;
			this.species = toID(this.set.species);
		}
		// if (!searchType || !this.set) return;
	}
	getResults(filters?: SearchFilter[] | null, sortCol?: string | null, reverseSort?: boolean): SearchRow[] {
		if (sortCol === 'type') {
			return [this.sortRow!, ...BattleTypeSearch.prototype.getDefaultResults.call(this, reverseSort)];
		} else if (sortCol === 'category') {
			return [this.sortRow!, ...BattleCategorySearch.prototype.getDefaultResults.call(this, reverseSort)];
		} else if (sortCol === 'ability') {
			return [this.sortRow!, ...BattleAbilitySearch.prototype.getDefaultResults.call(this, reverseSort)];
		}

		if (!this.baseResults) {
			this.baseResults = this.getBaseResults();
		}

		if (!this.baseIllegalResults) {
			const legalityFilter: { [id: string]: 1 } = {};
			for (const [resultType, value] of this.baseResults) {
				if (resultType === this.searchType) legalityFilter[value] = 1;
			}
			this.baseIllegalResults = [];
			this.illegalReasons = {};

			for (const id in this.getTable()) {
				if (!(id in legalityFilter)) {
					this.baseIllegalResults.push([this.searchType, id as ID]);
					this.illegalReasons[id] = 'Illegal';
				}
			}
		}

		let results: SearchRow[];
		let illegalResults: SearchRow[] | null;

		if (filters) {
			results = [];
			illegalResults = [];
			for (const result of this.baseResults) {
				if (this.filter(result, filters)) {
					if (results.length && result[0] === 'header' && results[results.length - 1][0] === 'header') {
						results[results.length - 1] = result;
					} else {
						results.push(result);
					}
				}
			}
			if (results.length && results[results.length - 1][0] === 'header') {
				results.pop();
			}
			for (const result of this.baseIllegalResults) {
				if (this.filter(result, filters)) {
					illegalResults.push(result);
				}
			}
		} else {
			results = [...this.baseResults];
			illegalResults = null;
		}
		if (this.defaultFilter) {
			results = this.defaultFilter(results);
		}

		if (sortCol) {
			results = results.filter(([rowType]) => rowType === this.searchType);
			results = this.sort(results, sortCol, reverseSort);
			if (illegalResults) {
				illegalResults = illegalResults.filter(([rowType]) => rowType === this.searchType);
				illegalResults = this.sort(illegalResults, sortCol, reverseSort);
			}
		}

		if (this.sortRow) {
			results = [this.sortRow, ...results];
		}
		if (illegalResults?.length) {
			results = [...results, ['header', "Illegal results"], ...illegalResults];
		}
		return results;
	}
	protected firstLearnsetid(speciesid: ID) {
		return this.dex.firstLearnsetid(speciesid);
	}
	protected nextLearnsetid(learnsetid: ID, speciesid: ID) {
		return this.dex.nextLearnsetid(learnsetid, speciesid);
	}
	protected canLearn(speciesid: ID, moveid: ID) {
		return this.dex.canLearn(speciesid, moveid);
	}
	getTier(pokemon: Dex.Species) {
		return this.dex.species.get(pokemon.name).tier;
	}
	eggMovesOnly(child: ID, father: ID) {
		if (this.dex.species.get(child).baseSpecies === this.dex.species.get(father).baseSpecies) return false;
		const baseSpecies = father;
		while (father) {
			if (child === father) return false;
			father = this.nextLearnsetid(father, baseSpecies);
		}
		return true;
	}
	abstract getTable(): { [id: string]: any };
	abstract getDefaultResults(): SearchRow[];
	abstract getBaseResults(): SearchRow[];
	abstract filter(input: SearchRow, filters: string[][]): boolean;
	defaultFilter?(input: SearchRow[]): SearchRow[];
	abstract sort(input: SearchRow[], sortCol: string, reverseSort?: boolean): SearchRow[];
}

class BattlePokemonSearch extends BattleTypedSearch<'pokemon'> {
	override sortRow: SearchRow = ['sortpokemon', ''];
	getTable() {
		return BattlePokedex;
	}
	getDefaultResults(): SearchRow[] {
		let results: SearchRow[] = [];
		for (let id in BattlePokedex) {
			switch (id) {
			case 'bulbasaur':
				results.push(['header', "Generation 1"]);
				break;
			case 'chikorita':
				results.push(['header', "Generation 2"]);
				break;
			case 'treecko':
				results.push(['header', "Generation 3"]);
				break;
			case 'turtwig':
				results.push(['header', "Generation 4"]);
				break;
			case 'victini':
				results.push(['header', "Generation 5"]);
				break;
			case 'chespin':
				results.push(['header', "Generation 6"]);
				break;
			case 'rowlet':
				results.push(['header', "Generation 7"]);
				break;
			case 'grookey':
				results.push(['header', "Generation 8"]);
				break;
			case 'sprigatito':
				results.push(['header', "Generation 9"]);
				break;
			case 'missingno':
				results.push(['header', "Glitch"]);
				break;
			case 'syclar':
				results.push(['header', "CAP"]);
				break;
			case 'pikachucosplay':
				continue;
			}
			results.push(['pokemon', id as ID]);
		}
		return results;
	}
	getBaseResults(): SearchRow[] {
		return this.dex.getTierSet();
	}
	filter(row: SearchRow, filters: string[][]) {
		if (!filters) return true;
		if (row[0] !== 'pokemon') return true;
		const species = this.dex.species.get(row[1]);
		for (const [filterType, value] of filters) {
			switch (filterType) {
			case 'type':
				// Nihilslave: change this for digimon, it works better anyway tho
				if (!species.types.includes(value as Dex.TypeName)) return false;
				break;
			case 'egggroup':
				if (species.eggGroups[0] !== value && species.eggGroups[1] !== value) return false;
				break;
			case 'tier':
				if (this.getTier(species) !== value) return false;
				break;
			case 'ability':
				if (!Dex.hasAbility(species, value)) return false;
				break;
			case 'move':
				if (!this.canLearn(species.id, value as ID)) return false;
			}
		}
		return true;
	}
	sort(results: SearchRow[], sortCol: string, reverseSort?: boolean) {
		const sortOrder = reverseSort ? -1 : 1;
		if (['hp', 'atk', 'def', 'spa', 'spd', 'spe'].includes(sortCol)) {
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				const stat1 = this.dex.species.get(id1).baseStats[sortCol as Dex.StatName];
				const stat2 = this.dex.species.get(id2).baseStats[sortCol as Dex.StatName];
				return (stat2 - stat1) * sortOrder;
			});
		} else if (sortCol === 'bst') {
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				const base1 = this.dex.species.get(id1).baseStats;
				const base2 = this.dex.species.get(id2).baseStats;
				let bst1 = base1.hp + base1.atk + base1.def + base1.spa + base1.spd + base1.spe;
				let bst2 = base2.hp + base2.atk + base2.def + base2.spa + base2.spd + base2.spe;
				if (this.dex.gen === 1) {
					bst1 -= base1.spd;
					bst2 -= base2.spd;
				}
				return (bst2 - bst1) * sortOrder;
			});
		} else if (sortCol === 'name') {
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				const name1 = id1;
				const name2 = id2;
				return (name1 < name2 ? -1 : name1 > name2 ? 1 : 0) * sortOrder;
			});
		}
		throw new Error("invalid sortcol");
	}
}

class BattleAbilitySearch extends BattleTypedSearch<'ability'> {
	getTable() {
		return BattleAbilities;
	}
	getDefaultResults(reverseSort?: boolean): SearchRow[] {
		const results: SearchRow[] = [];
		for (let id in BattleAbilities) {
			const skipped = ['noability', 'mountaineer', 'rebound', 'persistent', 'allseeingeye'];
			if (skipped.includes(id)) continue;
			results.push(['ability', id as ID]);
		}
		if (reverseSort) results.reverse();
		return results;
	}
	getBaseResults() {
		if (!this.set) return this.getDefaultResults();
		if (this.formats.includes('gen9morebalancedhackmons' as ID)) {
			return ([['header', "MBHv4"], ['ability', 'allseeingeye' as ID], ['header', "Abilities"]] as SearchRow[])
				.concat(this.getDefaultResults());
		}
		if (
			this.formats.includes('almostanyability' as ID) ||
			this.formats.includes('createmons' as ID) ||
			this.formats.includes('hackmons' as ID) ||
			this.formats.includes('metronome' as ID)
		) return ([['header', "Abilities"]] as SearchRow[]).concat(this.getDefaultResults());
		const dex = this.dex;
		let species = dex.species.getFromPokemon(this.set);
		let speciesAbilities = {...species.abilities};
		let abilitySet: SearchRow[] = [['header', "Abilities"]];

		if (species.isMega) {
			abilitySet.unshift(['html', `Will be <strong>${speciesAbilities['0']}</strong> after Mega Evolving.`]);
			species = dex.species.get(species.baseSpecies);
		}
		if (species.forme === 'X') {
			abilitySet.unshift(['html', `Will be <strong>${speciesAbilities['0']}</strong> after X-Evolving.`]);
			species = dex.species.get(species.baseSpecies);
		}
		abilitySet.push(['ability', toID(speciesAbilities['0'])]);
		if (speciesAbilities['1']) {
			abilitySet.push(['ability', toID(speciesAbilities['1'])]);
		}
		if (speciesAbilities['H']) {
			abilitySet.push(['header', "Hidden Ability"]);
			abilitySet.push(['ability', toID(speciesAbilities['H'])]);
		}
		if (speciesAbilities['S']) {
			abilitySet.push(['header', "Special Event Ability"]);
			abilitySet.push(['ability', toID(speciesAbilities['S'])]);
		}
		return abilitySet;
	}
	filter(row: SearchRow, filters: string[][]) {
		if (!filters) return true;
		if (row[0] !== 'ability') return true;
		const ability = this.dex.abilities.get(row[1]);
		for (const [filterType, value] of filters) {
			switch (filterType) {
			case 'pokemon':
				if (!Dex.hasAbility(this.dex.species.get(value), ability.name)) return false;
				break;
			}
		}
		return true;
	}
	sort(results: SearchRow[], sortCol: string | null, reverseSort?: boolean): SearchRow[] {
		throw new Error("invalid sortcol");
	}
}

class BattleItemSearch extends BattleTypedSearch<'item'> {
	getTable() {
		return BattleItems;
	}
	getDefaultResults(): SearchRow[] {
		return this.dex.getItemSet();
	}
	getBaseResults(): SearchRow[] {
		if (!this.species) return this.getDefaultResults();
		const speciesName = this.dex.species.get(this.species).name;
		const results = this.getDefaultResults();
		const speciesSpecific: SearchRow[] = [];
		const abilitySpecific: SearchRow[] = [];
		const abilityItem = {
			protosynthesis: 'boosterenergy',
			quarkdrive: 'boosterenergy',
			// poisonheal: 'toxicorb',
			// toxicboost: 'toxicorb',
			// flareboost: 'flameorb',
		}[toID(this.set?.ability) as string];
		for (const row of results) {
			if (row[0] !== 'item') continue;
			const item = this.dex.items.get(row[1]);
			if (item.itemUser?.includes(speciesName)) speciesSpecific.push(row);
			if (abilityItem === item.id) abilitySpecific.push(row);
		}
		if (speciesSpecific.length) {
			return [
				['header', "Specific to " + speciesName],
				...speciesSpecific,
				...results,
			];
		}
		if (abilitySpecific.length) {
			return [
				['header', `Specific to ${this.set!.ability!}`],
				...abilitySpecific,
				...results,
			];
		}
		return results;
	}
	override defaultFilter(results: SearchRow[]) {
		if (this.species && !this.dex.species.get(this.species).nfe) {
			results.splice(results.findIndex(row => row[1] === 'eviolite'), 1);
			return results;
		}
		return results;
	}
	filter(row: SearchRow, filters: string[][]) {
		return true;
	}
	sort(results: SearchRow[], sortCol: string | null, reverseSort?: boolean): SearchRow[] {
		throw new Error("invalid sortcol");
	}
}

class BattleMoveSearch extends BattleTypedSearch<'move'> {
	override sortRow: SearchRow = ['sortmove', ''];
	getTable() {
		return BattleMovedex;
	}
	getDefaultResults(): SearchRow[] {
		let results: SearchRow[] = [];
		results.push(['header', "Moves"]);
		for (let id in BattleMovedex) {
			const skipped = ['paleowave', 'shadowstrike'];
			if (skipped.includes(id)) continue;
			results.push(['move', id as ID]);
		}
		return results;
	}
	private moveIsNotUseless(id: ID, species: Dex.Species, moves: string[], set: Dex.PokemonSet | null) {
		const dex = this.dex;

		let abilityid: ID = set ? toID(set.ability) : '' as ID;
		const itemid: ID = set ? toID(set.item) : '' as ID;

		if (dex.gen === 1) {
			// Usually not useless for Gen 1
			if ([
				'acidarmor', 'amnesia', 'barrier', 'bind', 'blizzard', 'clamp', 'confuseray', 'counter', 'firespin', 'growth', 'headbutt', 'hyperbeam', 'mirrormove', 'pinmissile', 'razorleaf', 'sing', 'slash', 'sludge', 'twineedle', 'wrap',
			].includes(id)) {
				return true;
			}

			// Usually useless for Gen 1
			if ([
				'disable', 'haze', 'leechseed', 'quickattack', 'roar', 'thunder', 'toxic', 'triattack', 'waterfall', 'whirlwind',
			].includes(id)) {
				return false;
			}

			// Not useless only when certain moves aren't present
			switch (id) {
			case 'bubblebeam': return (!moves.includes('surf') && !moves.includes('blizzard'));
			case 'doubleedge': return !moves.includes('bodyslam');
			case 'doublekick': return !moves.includes('submission');
			case 'firepunch': return !moves.includes('fireblast');
			case 'megadrain': return !moves.includes('razorleaf') && !moves.includes('surf');
			case 'megakick': return !moves.includes('hyperbeam');
			case 'reflect': return !moves.includes('barrier') && !moves.includes('acidarmor');
			case 'stomp': return !moves.includes('headbutt');
			case 'submission': return !moves.includes('highjumpkick');
			case 'thunderpunch': return !moves.includes('thunderbolt');
			case 'triattack': return !moves.includes('bodyslam');
			}
			// Useful and Useless moves for Stadium OU, which changes many game mechanics.
			if (this.dex.modid.includes('stadium' as ID)) {
				if (['doubleedge', 'focusenergy', 'haze'].includes(id)) return true;
				if (['hyperbeam', 'sing', 'hypnosis'].includes(id)) return false;
				switch (id) {
				case 'fly': return !moves.includes('drillpeck');
				case 'dig': return !moves.includes('earthquake');
				}
			}
		}

		if (this.dex.modid.includes('gen7letsgo' as ID)) {
			if (['megadrain', 'teleport'].includes(id)) return true;
		}

		if (this.dex.modid.includes('metronome' as ID)) {
			if (id === 'metronome') return true;
		}

		if (itemid === 'pidgeotite') abilityid = 'noguard' as ID;
		if (itemid === 'blastoisinite') abilityid = 'megalauncher' as ID;
		if (itemid === 'aerodactylite') abilityid = 'toughclaws' as ID;
		if (itemid === 'glalitite') abilityid = 'refrigerate' as ID;

		switch (id) {
		case 'fakeout': case 'flamecharge': case 'nuzzle': case 'poweruppunch': case 'trailblaze':
			return abilityid !== 'sheerforce';
		case 'solarbeam': case 'solarblade':
			return ['desolateland', 'drought', 'chlorophyll', 'orichalcumpulse'].includes(abilityid) || itemid === 'powerherb';
		case 'dynamicpunch': case 'grasswhistle': case 'inferno': case 'sing':
			return abilityid === 'noguard';
		case 'heatcrash': case 'heavyslam':
			return species.weightkg >= (species.evos ? 75 : 130);
		case 'aerialace':
			return ['technician', 'toughclaws'].includes(abilityid) && !moves.includes('bravebird');
		case 'ancientpower':
			return ['serenegrace', 'technician'].includes(abilityid) || !moves.includes('powergem');
		case 'aquajet':
			return !moves.includes('jetpunch');
		case 'aurawheel':
			return species.baseSpecies === 'Morpeko';
		case 'axekick':
			return !moves.includes('highjumpkick');
		case 'bellydrum':
			return moves.includes('aquajet') || moves.includes('jetpunch') || moves.includes('extremespeed') ||
				['iceface', 'unburden'].includes(abilityid);
		case 'bulletseed':
			return ['skilllink', 'technician'].includes(abilityid);
		case 'chillingwater':
			return !moves.includes('scald');
		case 'counter':
			return species.baseStats.hp >= 65;
		case 'dazzlinggleam':
			return !moves.includes('alluringvoice') || this.formats.includes('doubles' as ID);
		case 'darkvoid':
			return dex.gen < 7;
		case 'dualwingbeat':
			return abilityid === 'technician' || !moves.includes('drillpeck');
		case 'electroshot':
			return true;
		case 'feint':
			return abilityid === 'refrigerate';
		case 'futuresight':
			return dex.gen > 5;
		case 'grassyglide':
			return abilityid === 'grassysurge';
		case 'gyroball':
			return species.baseStats.spe <= 60;
		case 'headbutt':
			return abilityid === 'serenegrace';
		case 'hex':
			return !moves.includes('infernalparade');
		case 'hiddenpowerelectric':
			return (dex.gen < 4 && !moves.includes('thunderpunch')) && !moves.includes('thunderbolt');
		case 'hiddenpowerfighting':
			return (dex.gen < 4 && !moves.includes('brickbreak')) && !moves.includes('aurasphere') && !moves.includes('focusblast');
		case 'hiddenpowerfire':
			return (dex.gen < 4 && !moves.includes('firepunch')) && !moves.includes('flamethrower') &&
				!moves.includes('mysticalfire') && !moves.includes('burningjealousy');
		case 'hiddenpowergrass':
			return (dex.gen < 4 && !moves.includes('leafblade')) ||
				(dex.gen > 3 && !moves.includes('energyball') && !moves.includes('grassknot') && !moves.includes('gigadrain'));
		case 'hiddenpowerice':
			return !moves.includes('icebeam') && (dex.gen < 4 && !moves.includes('icepunch')) ||
				(dex.gen > 5 && !moves.includes('aurorabeam') && !moves.includes('glaciate'));
		case 'hiddenpowerflying':
			return dex.gen < 4 && !moves.includes('drillpeck');
		case 'hiddenpowerbug':
			return dex.gen < 4 && !moves.includes('megahorn');
		case 'hiddenpowerpsychic':
			return species.baseSpecies === 'Unown';
		case 'hyperspacefury':
			return species.id === 'hoopaunbound';
		case 'hypnosis':
			return (dex.gen < 4 && !moves.includes('sleeppowder')) || (dex.gen > 6 && abilityid === 'baddreams');
		case 'icepunch':
			return !moves.includes('icespinner') || ['sheerforce', 'ironfist'].includes(abilityid) || itemid === 'punchingglove';
		case 'iciclecrash':
			return !moves.includes('mountaingale');
		case 'iciclespear':
			return dex.gen > 3;
		case 'icywind':
			// Keldeo needs Hidden Power for Electric/Ghost
			return species.baseSpecies === 'Keldeo' || this.dex.modid.includes('doubles' as ID);
		case 'infestation':
			return moves.includes('stickyweb');
		case 'irondefense':
			return !moves.includes('acidarmor');
		case 'irontail':
			return dex.gen > 5 && !moves.includes('ironhead') && !moves.includes('gunkshot') && !moves.includes('poisonjab');
		case 'jumpkick':
			return !moves.includes('highjumpkick') && !moves.includes('axekick');
		case 'lastresort':
			return set && set.moves.length < 3;
		case 'leafblade':
			return dex.gen < 4;
		case 'leechlife':
			return dex.gen > 6;
		case 'magiccoat':
			return dex.gen > 3;
		case 'meteorbeam':
			return true;
		case 'mysticalfire':
			return dex.gen > 6 && !moves.includes('flamethrower');
		case 'naturepower':
			return dex.gen === 5;
		case 'needlearm':
			return dex.gen < 4;
		case 'nightslash':
			return !moves.includes('crunch') && !(moves.includes('knockoff') && dex.gen >= 6);
		case 'outrage':
			return dex.gen > 3 && !moves.includes('glaiverush');
		case 'petaldance':
			return abilityid === 'owntempo';
		case 'phantomforce':
			return (!moves.includes('poltergeist') && !moves.includes('shadowclaw')) || this.dex.modid.includes('doubles' as ID);
		case 'poisonfang':
			return species.types.includes('Poison') && !moves.includes('gunkshot') && !moves.includes('poisonjab');
		case 'raindance':
			return dex.gen < 4;
		case 'relicsong':
			return species.id === 'meloetta';
		case 'refresh':
			return !moves.includes('aromatherapy') && !moves.includes('healbell');
		case 'risingvoltage':
			return abilityid === 'electricsurge' || abilityid === 'hadronengine';
		case 'rocktomb':
			return abilityid === 'technician';
		case 'selfdestruct':
			return dex.gen < 5 && !moves.includes('explosion');
		case 'shadowpunch':
			return abilityid === 'ironfist' && !moves.includes('ragefist');
		case 'shelter':
			return !moves.includes('acidarmor') && !moves.includes('irondefense');
		case 'skyuppercut':
			return dex.gen < 4;
		case 'smackdown':
			return species.types.includes('Ground');
		case 'smartstrike':
			return species.types.includes('Steel') && !moves.includes('ironhead');
		case 'soak':
			return abilityid === 'unaware';
		case 'steelwing':
			return !moves.includes('ironhead');
		case 'stompingtantrum':
			return (!moves.includes('earthquake') && !moves.includes('drillrun')) || this.dex.modid.includes('doubles' as ID);
		case 'stunspore':
			return !moves.includes('thunderwave');
		case 'sunnyday':
			return dex.gen < 4;
		case 'technoblast':
			return dex.gen > 5 && itemid.endsWith('drive') || itemid === 'dousedrive';
		case 'teleport':
			return dex.gen > 7;
		case 'temperflare':
			return (!moves.includes('flareblitz') && !moves.includes('pyroball') && !moves.includes('sacredfire') &&
				!moves.includes('bitterblade') && !moves.includes('firepunch')) || this.formats.includes('doubles' as ID);
		case 'terrainpulse': case 'waterpulse':
			return ['megalauncher', 'technician'].includes(abilityid) && !moves.includes('originpulse');
		case 'thief':
			return dex.gen === 2;
		case 'toxicspikes':
			return abilityid !== 'toxicdebris';
		case 'triattack':
			return dex.gen > 3;
		case 'trickroom':
			return species.baseStats.spe <= 100;
		case 'wildcharge':
			return !moves.includes('supercellslam');
		case 'zapcannon':
			return abilityid === 'noguard' || (dex.gen < 4 && !moves.includes('thunderwave'));
		}

		if (this.dex.modid.includes('doubles' as ID) && BattleMoveSearch.GOOD_DOUBLES_MOVES.includes(id)) {
			return true;
		}

		const move = dex.moves.get(id);
		if (!move.exists) return true;
		if ((move.status === 'slp' || id === 'yawn') && dex.gen === 9 && !this.formats) {
			return false;
		}
		if (move.category === 'Status') {
			return BattleMoveSearch.GOOD_STATUS_MOVES.includes(id);
		}
		if (move.basePower < 75) {
			return BattleMoveSearch.GOOD_WEAK_MOVES.includes(id);
		}
		if (id === 'skydrop') return true;
		// strong moves
		if (move.flags['charge']) {
			return itemid === 'powerherb';
		}
		if (move.flags['recharge']) {
			return false;
		}
		if (move.flags['slicing'] && abilityid === 'sharpness') {
			return true;
		}
		return !BattleMoveSearch.BAD_STRONG_MOVES.includes(id);
	}
	static readonly GOOD_STATUS_MOVES = [
		'acidarmor', 'agility', 'aromatherapy', 'auroraveil', 'autotomize', 'banefulbunker', 'batonpass', 'bellydrum', 'bulkup', 'burningbulwark', 'calmmind', 'chillyreception', 'clangoroussoul', 'coil', 'cottonguard', 'courtchange', 'curse', 'defog', 'destinybond', 'detect', 'disable', 'dragondance', 'encore', 'extremeevoboost', 'filletaway', 'geomancy', 'glare', 'haze', 'healbell', 'healingwish', 'healorder', 'heartswap', 'honeclaws', 'kingsshield', 'leechseed', 'lightscreen', 'lovelykiss', 'lunardance', 'magiccoat', 'maxguard', 'memento', 'milkdrink', 'moonlight', 'morningsun', 'nastyplot', 'naturesmadness', 'noretreat', 'obstruct', 'painsplit', 'partingshot', 'perishsong', 'protect', 'quiverdance', 'recover', 'reflect', 'reflecttype', 'rest', 'revivalblessing', 'roar', 'rockpolish', 'roost', 'shedtail', 'shellsmash', 'shiftgear', 'shoreup', 'silktrap', 'slackoff', 'sleeppowder', 'sleeptalk', 'softboiled', 'spikes', 'spikyshield', 'spore', 'stealthrock', 'stickyweb', 'strengthsap', 'substitute', 'switcheroo', 'swordsdance', 'synthesis', 'tailglow', 'tailwind', 'taunt', 'thunderwave', 'tidyup', 'toxic', 'transform', 'trick', 'victorydance', 'whirlwind', 'willowisp', 'wish', 'yawn',
	] as ID[] as readonly ID[];
	static readonly GOOD_WEAK_MOVES = [
		'accelerock', 'acrobatics', 'aquacutter', 'avalanche', 'barbbarrage', 'bonemerang', 'bouncybubble', 'bulletpunch', 'buzzybuzz', 'ceaselessedge', 'circlethrow', 'clearsmog', 'doubleironbash', 'dragondarts', 'dragontail', 'drainingkiss', 'endeavor', 'facade', 'firefang', 'flipturn', 'flowertrick', 'freezedry', 'frustration', 'geargrind', 'gigadrain', 'grassknot', 'gyroball', 'icefang', 'iceshard', 'iciclespear', 'infernalparade', 'knockoff', 'lastrespects', 'lowkick', 'machpunch', 'mortalspin', 'mysticalpower', 'naturesmadness', 'nightshade', 'nuzzle', 'pikapapow', 'populationbomb', 'psychocut', 'psyshieldbash', 'pursuit', 'quickattack', 'ragefist', 'rapidspin', 'return', 'rockblast', 'ruination', 'saltcure', 'scorchingsands', 'seismictoss', 'shadowclaw', 'shadowsneak', 'sizzlyslide', 'stoneaxe', 'storedpower', 'stormthrow', 'suckerpunch', 'superfang', 'surgingstrikes', 'tachyoncutter', 'tailslap', 'thunderclap', 'tripleaxel', 'tripledive', 'twinbeam', 'uturn', 'veeveevolley', 'voltswitch', 'watershuriken', 'weatherball',
	] as ID[] as readonly ID[];
	static readonly BAD_STRONG_MOVES = [
		'belch', 'burnup', 'crushclaw', 'dragonrush', 'dreameater', 'eggbomb', 'firepledge', 'flyingpress', 'futuresight', 'grasspledge', 'hyperbeam', 'hyperfang', 'hyperspacehole', 'jawlock', 'landswrath', 'megakick', 'megapunch', 'mistyexplosion', 'muddywater', 'nightdaze', 'pollenpuff', 'rockclimb', 'selfdestruct', 'shelltrap', 'skyuppercut', 'slam', 'strength', 'submission', 'synchronoise', 'takedown', 'thrash', 'uproar', 'waterpledge',
	] as ID[] as readonly ID[];
	static readonly GOOD_DOUBLES_MOVES = [
		'allyswitch', 'bulldoze', 'coaching', 'electroweb', 'faketears', 'fling', 'followme', 'healpulse', 'helpinghand', 'junglehealing', 'lifedew', 'lunarblessing', 'muddywater', 'pollenpuff', 'psychup', 'ragepowder', 'safeguard', 'skillswap', 'snipeshot', 'wideguard',
	] as ID[] as readonly ID[];
	getBaseResults() {
		if (!this.set) return this.getDefaultResults();
		const dex = this.dex;
		let species = dex.species.get(this.species);
		const moves = dex.getLearnsetMoves(this.set);
		moves.sort();

		let usableMoves: SearchRow[] = [];
		let uselessMoves: SearchRow[] = [];
		for (const id of moves) {
			const isUsable = this.moveIsNotUseless(id as ID, species, moves, this.set);
			if (isUsable) {
				if (!usableMoves.length) usableMoves.push(['header', "Moves"]);
				usableMoves.push(['move', id as ID]);
			} else {
				if (!uselessMoves.length) uselessMoves.push(['header', "Usually useless moves"]);
				uselessMoves.push(['move', id as ID]);
			}
		}
		return [...usableMoves, ...uselessMoves];
	}
	filter(row: SearchRow, filters: string[][]) {
		if (!filters) return true;
		if (row[0] !== 'move') return true;
		const move = this.dex.moves.get(row[1]);
		for (const [filterType, value] of filters) {
			switch (filterType) {
			case 'type':
				if (move.type !== value) return false;
				break;
			case 'category':
				if (move.category !== value) return false;
				break;
			case 'pokemon':
				if (!this.canLearn(value as ID, move.id)) return false;
				break;
			}
		}
		return true;
	}
	sort(results: SearchRow[], sortCol: string, reverseSort?: boolean): SearchRow[] {
		const sortOrder = reverseSort ? -1 : 1;
		switch (sortCol) {
		case 'power':
			let powerTable: { [id: string]: number | undefined } = {
				return: 102, frustration: 102, spitup: 300, trumpcard: 200, naturalgift: 80, grassknot: 120,
				lowkick: 120, gyroball: 150, electroball: 150, flail: 200, reversal: 200, present: 120,
				wringout: 120, crushgrip: 120, heatcrash: 120, heavyslam: 120, fling: 130, magnitude: 150,
				beatup: 24, punishment: 1020, psywave: 1250, nightshade: 1200, seismictoss: 1200,
				dragonrage: 1140, sonicboom: 1120, superfang: 1350, endeavor: 1399, sheercold: 1501,
				fissure: 1500, horndrill: 1500, guillotine: 1500,
			};
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				let move1 = this.dex.moves.get(id1);
				let move2 = this.dex.moves.get(id2);
				let pow1 = move1.basePower || powerTable[id1] || (move1.category === 'Status' ? -1 : 1400);
				let pow2 = move2.basePower || powerTable[id2] || (move2.category === 'Status' ? -1 : 1400);
				return (pow2 - pow1) * sortOrder;
			});
		case 'accuracy':
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				let accuracy1 = this.dex.moves.get(id1).accuracy || 0;
				let accuracy2 = this.dex.moves.get(id2).accuracy || 0;
				if (accuracy1 === true) accuracy1 = 101;
				if (accuracy2 === true) accuracy2 = 101;
				return (accuracy2 - accuracy1) * sortOrder;
			});
		case 'pp':
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				let pp1 = this.dex.moves.get(id1).pp || 0;
				let pp2 = this.dex.moves.get(id2).pp || 0;
				return (pp2 - pp1) * sortOrder;
			});
		case 'name':
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				const name1 = id1;
				const name2 = id2;
				return (name1 < name2 ? -1 : name1 > name2 ? 1 : 0) * sortOrder;
			});
		case 'point':
			return results.sort(([rowType1, id1], [rowType2, id2]) => {
				let point1 = exports.moveToPoint[id1] || 0.5;
				let point2 = exports.moveToPoint[id2] || 0.5;
				// don't show banned moves
				if (point1 === 1000000) point1 = -1 * sortOrder;
				if (point2 === 1000000) point2 = -1 * sortOrder;
				return (point2 - point1) * sortOrder;
			});
		}
		throw new Error("invalid sortcol");
	}
}

class BattleCategorySearch extends BattleTypedSearch<'category'> {
	getTable() {
		return { physical: 1, special: 1, status: 1 };
	}
	getDefaultResults(reverseSort?: boolean): SearchRow[] {
		const results: SearchRow[] = [
			['category', 'physical' as ID],
			['category', 'special' as ID],
			['category', 'status' as ID],
		];
		if (reverseSort) results.reverse();
		return results;
	}
	getBaseResults() {
		return this.getDefaultResults();
	}
	filter(row: SearchRow, filters: string[][]): boolean {
		throw new Error("invalid filter");
	}
	sort(results: SearchRow[], sortCol: string | null, reverseSort?: boolean): SearchRow[] {
		throw new Error("invalid sortcol");
	}
}

class BattleTypeSearch extends BattleTypedSearch<'type'> {
	
	getTable() {
		return window.BattleTypeChart;
	}
	getDefaultResults(reverseSort?: boolean): SearchRow[] {
		const results = this.dex.getTypeSet();
		if (reverseSort) results.reverse();
		return results;
	}
	getBaseResults() {
		return this.getDefaultResults();
	}
	filter(row: SearchRow, filters: string[][]): boolean {
		throw new Error("invalid filter");
	}
	sort(results: SearchRow[], sortCol: string | null, reverseSort?: boolean): SearchRow[] {
		throw new Error("invalid sortcol");
	}
}