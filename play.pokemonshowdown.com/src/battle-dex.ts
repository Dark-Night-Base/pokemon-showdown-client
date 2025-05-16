/**
 * Pokemon Showdown Dex
 *
 * Roughly equivalent to sim/dex.js in a Pokemon Showdown server, but
 * designed for use in browsers rather than in Node.
 *
 * This is a generic utility library for Pokemon Showdown code: any
 * code shared between the replay viewer and the client usually ends up
 * here.
 *
 * Licensing note: PS's client has complicated licensing:
 * - The client as a whole is AGPLv3
 * - The battle replay/animation engine (battle-*.ts) by itself is MIT
 *
 * Compiled into battledata.js which includes all dependencies
 *
 * @author Guangcong Luo <guangcongluo@gmail.com>
 * @license MIT
 */

import { Pokemon, type ServerPokemon } from "./battle";
import {
	BattleAvatarNumbers, BattleBaseSpeciesChart, BattlePokemonIconIndexes, BattlePokemonIconIndexesLeft, BattleStatNames,
	Ability, Item, Move, Species, PureEffect, type ID, type Type,
} from "./battle-dex-data";
import type * as DexData from "./battle-dex-data";
import type { SearchRow } from "./battle-dex-search";

export declare namespace Dex {
	/* eslint-disable @typescript-eslint/no-shadow */
	export type Ability = DexData.Ability;
	export type Item = DexData.Item;
	export type Move = DexData.Move;
	export type Species = DexData.Species;
	export type Type = DexData.Type;
	export type Nature = DexData.Nature;
	export type PureEffect = DexData.PureEffect;
	export type Effect = DexData.Effect;
	export type ID = DexData.ID;
	/* eslint-enable @typescript-eslint/no-shadow */
	export type StatName = DexData.StatName;
	export type StatNameExceptHP = DexData.StatNameExceptHP;
	export type BoostStatName = DexData.BoostStatName;
	export type TypeName = DexData.TypeName;
	export type StatusName = DexData.StatusName;
	export type GenderName = DexData.GenderName;
	export type NatureName = DexData.NatureName;
	export type MoveTarget = DexData.MoveTarget;
	export type REGULAR = 0;
	export type WEAK = 1;
	export type RESIST = 2;
	export type IMMUNE = 3;
	export type WeaknessType = REGULAR | WEAK | RESIST | IMMUNE;
	export type StatsTable = { hp: number, atk: number, def: number, spa: number, spd: number, spe: number };
	/**
	 * Dex.PokemonSet can be sparse, in which case that entry should be
	 * inferred from the rest of the set, according to sensible
	 * defaults.
	 */
	export interface PokemonSet {
		/** Defaults to species name (not including forme), like in games */
		name?: string;
		species: string;
		/** Defaults to no item */
		item?: string;
		/** Defaults to no ability (error in Gen 3+) */
		ability?: string;
		moves: string[];
		/** Defaults to no nature (error in Gen 3+) */
		nature?: NatureName;
		/** Defaults to random legal gender, NOT subject to gender ratios */
		gender?: string;
		/** Defaults to flat 252's (200's/0's in Let's Go) (error in gen 3+) */
		evs?: Partial<Dex.StatsTable>;
		/** Defaults to whatever makes sense - flat 31's unless you have Gyro Ball etc */
		ivs?: Dex.StatsTable;
		/** Defaults as you'd expect (100 normally, 50 in VGC-likes, 5 in LC) */
		level?: number;
		/** Defaults to no (error if shiny event) */
		shiny?: boolean;
		/** Defaults to 255 unless you have Frustration, in which case 0 */
		happiness?: number;
		/** Defaults to event required ball, otherwise Poké Ball */
		pokeball?: string;
		/** Defaults to the type of your Hidden Power in Moves, otherwise Dark */
		hpType?: string;
		/** Defaults to 10 */
		dynamaxLevel?: number;
		/** Defaults to no (can only be yes for certain Pokemon) */
		gigantamax?: boolean;
		/** Defaults to the primary type */
		teraType?: string;
		/** for digimon */
		preEvo?: string;
	}
}
export type { ID };

declare const require: any;
declare const global: any;
declare const process: any;

if (typeof window === 'undefined') {
	// Node
	global.window = global;
} else {
	// browser (possibly NW.js!)
	window.exports = window;
}

window.nodewebkit = !!(typeof process !== 'undefined' && process.versions?.['node-webkit']);

export function toID(text: any) {
	if (text?.id) {
		text = text.id;
	} else if (text?.userid) {
		text = text.userid;
	}
	if (typeof text !== 'string' && typeof text !== 'number') return '' as ID;
	return `${text}`.toLowerCase().replace(/[^a-z0-9]+/g, '') as ID;
}

export function toUserid(text: any) {
	return toID(text);
}

type Comparable = number | string | boolean | Comparable[] | { reverse: Comparable };
export const PSUtils = new class {
	/**
	 * Like string.split(delimiter), but only recognizes the first `limit`
	 * delimiters (default 1).
	 *
	 * `"1 2 3 4".split(" ", 2) => ["1", "2"]`
	 *
	 * `splitFirst("1 2 3 4", " ", 1) => ["1", "2 3 4"]`
	 *
	 * Returns an array of length exactly limit + 1.
	 */
	splitFirst(str: string, delimiter: string, limit = 1) {
		let splitStr: string[] = [];
		while (splitStr.length < limit) {
			let delimiterIndex = str.indexOf(delimiter);
			if (delimiterIndex >= 0) {
				splitStr.push(str.slice(0, delimiterIndex));
				str = str.slice(delimiterIndex + delimiter.length);
			} else {
				splitStr.push(str);
				str = '';
			}
		}
		splitStr.push(str);
		return splitStr;
	}

	/**
	 * Compares two variables; intended to be used as a smarter comparator.
	 * The two variables must be the same type (TypeScript will not check this).
	 *
	 * - Numbers are sorted low-to-high, use `-val` to reverse
	 * - Strings are sorted A to Z case-semi-insensitively, use `{reverse: val}` to reverse
	 * - Booleans are sorted true-first (REVERSE of casting to numbers), use `!val` to reverse
	 * - Arrays are sorted lexically in the order of their elements
	 *
	 * In other words: `[num, str]` will be sorted A to Z, `[num, {reverse: str}]` will be sorted Z to A.
	 */
	compare(a: Comparable, b: Comparable): number {
		if (typeof a === 'number') {
			return a - (b as number);
		}
		if (typeof a === 'string') {
			return a.localeCompare(b as string);
		}
		if (typeof a === 'boolean') {
			return (a ? 1 : 2) - (b ? 1 : 2);
		}
		if (Array.isArray(a)) {
			for (let i = 0; i < a.length; i++) {
				const comparison = PSUtils.compare(a[i], (b as Comparable[])[i]);
				if (comparison) return comparison;
			}
			return 0;
		}
		if (a.reverse) {
			return PSUtils.compare((b as { reverse: string }).reverse, a.reverse);
		}
		throw new Error(`Passed value ${a as any} is not comparable`);
	}
	/**
	 * Sorts an array according to the callback's output on its elements.
	 *
	 * The callback's output is compared according to `PSUtils.compare` (in
	 * particular, it supports arrays so you can sort by multiple things).
	 */
	sortBy<T>(array: T[], callback: (a: T) => Comparable): T[];
	/**
	 * Sorts an array according to `PSUtils.compare`. (Correctly sorts numbers,
	 * unlike `array.sort`)
	 */
	sortBy<T extends Comparable>(array: T[]): T[];
	sortBy<T>(array: T[], callback?: (a: T) => Comparable) {
		if (!callback) return (array as any[]).sort(PSUtils.compare);
		return array.sort((a, b) => PSUtils.compare(callback(a), callback(b)));
	}
};

/**
 * Sanitize a room ID by removing anything that isn't alphanumeric or `-`.
 * Shouldn't actually do anything except against malicious input.
 */
export function toRoomid(roomid: string) {
	return roomid.replace(/[^a-zA-Z0-9-]+/g, '').toLowerCase();
}

export function toName(name: any) {
	if (typeof name !== 'string' && typeof name !== 'number') return '';
	name = `${name}`.replace(/[|\s[\],\u202e]+/g, ' ').trim();
	if (name.length > 18) name = name.substr(0, 18).trim();

	// remove zalgo
	name = name.replace(
		/[\u0300-\u036f\u0483-\u0489\u0610-\u0615\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06ED\u0E31\u0E34-\u0E3A\u0E47-\u0E4E]{3,}/g,
		''
	);
	name = name.replace(/[\u239b-\u23b9]/g, '');

	return name;
}

export interface SpriteData {
	w: number;
	h: number;
	y?: number;
	gen?: number;
	url?: string;
	rawHTML?: string;
	pixelated?: boolean;
	isFrontSprite?: boolean;
	cryurl?: string;
	shiny?: boolean;
}

export interface TeambuilderSpriteData {
	x: number;
	y: number;
	spriteDir: string;
	spriteid: string;
	shiny?: boolean;
}

export const Dex = new class implements ModdedDex {
	readonly Ability = Ability;
	readonly Item = Item;
	readonly Move = Move;
	readonly Species = Species;

	readonly gen = 9;
	readonly learnsetGenchar = 'a';
	readonly currentGen = `gen${this.gen}`;
	readonly modid = [this.currentGen, this.currentGen] as ID[];
	readonly cache = null!;

	readonly REGULAR = 0;
	readonly WEAK = 1;
	readonly RESIST = 2;
	readonly IMMUNE = 3;

	readonly statNames: readonly Dex.StatName[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
	readonly statNamesExceptHP: readonly Dex.StatNameExceptHP[] = ['atk', 'def', 'spa', 'spd', 'spe'];

	pokeballs: string[] | null = null;

	resourcePrefix = (() => {
		let prefix = '';
		if (window.document?.location?.protocol !== 'http:') prefix = 'https:';
		return `${prefix}//${window.Config ? Config.routes.client : 'play.pokemonshowdown.com'}/`;
		// return `${prefix}//play.pokemonshowdown.com/`;
	})();

	fxPrefix = (() => {
		const protocol = (window.document?.location?.protocol !== 'http:') ? 'https:' : '';
		return `${protocol}//${window.Config ? Config.routes.client : 'play.pokemonshowdown.com'}/fx/`;
	})();

	loadedSpriteData = { xy: 1, bw: 0 };
	moddedDexes: { [mod: string]: ModdedDex } = {};

	parseFormatid(formatid: ID): ID[] {
		let modids = [];

		// this theoratically should be /gen\d+/, but now this to avoid errors when gen9350cup
		const genStrings = /gen\d/.exec(formatid); // /gen(10|\d)/ after gen 10 releases
		const gen = genStrings ? genStrings[0] : this.currentGen;
		// regulars
		if (formatid.includes('anythinggoes') || formatid.endsWith('ag')) modids.push('anythinggoes' as ID);
		if (formatid.includes('doubles') ||
			formatid.includes('freeforall') || formatid.startsWith(gen + 'ffa') ||
			formatid.includes('multibattle')) modids.push('doubles' as ID);
		if (formatid.includes('littlecup') || formatid.endsWith('lc')) modids.push('littlecup' as ID);
		if (formatid.includes('nfe')) modids.push('nfe' as ID);
		if (formatid.endsWith('ou')) modids.push('ou' as ID);
		// oms
		if (/\d\d\dcup/.exec(formatid)) modids.push(/\d\d\dcup/.exec(formatid)![0] as ID);
		if (formatid.includes('almostanyability') || formatid.includes('aaa')) modids.push('almostanyability' as ID);
		if (formatid.includes('categoryswap')) modids.push('categoryswap' as ID);
		if (formatid.includes('hackmons') || formatid.endsWith('bh')) modids.push('hackmons' as ID);
		if (formatid.includes('metronome')) modids.push('metronome' as ID);
		if (formatid.includes('regicup')) modids.push('regicup' as ID);
		if (formatid.includes('scalemons')) modids.push('scalemons' as ID);
		if (formatid.includes('stabmons') || formatid.includes('staaabmons')) modids.push('stabmons' as ID);
		if (formatid.includes('thecardgame')) modids.push('thecardgame' as ID);
		// species oms
		// mnm, camo, ce, ...
		if (formatid.includes('createmons')) modids.push('createmons' as ID);
		if (formatid.includes('crossevolution')) modids.push('crossevolution' as ID);
		if (formatid.includes('infinitefusion')) modids.push('infinitefusion' as ID);
		// teambuilder oms
		// aka mia-like formats
		if (formatid.includes('fortemons') || formatid.includes('moveitemability')) modids.push('fortemons' as ID);
		if (formatid.includes('trademarked') || formatid.includes('moveitemability')) modids.push('trademarked' as ID);
		if (formatid.includes('multibility') || formatid.includes('moveitemability')) modids.push('multibility' as ID);
		if (formatid.includes('dualwielding') || formatid.includes('moveitemability')) modids.push('dualwielding' as ID);
		if (formatid.includes('abilityspam')) modids.push('abilityspam' as ID);
		if (formatid.includes('monotype')) modids.push('monotype' as ID);
		// essentially pet mods
		if (
			formatid.includes('nationaldex') || formatid.includes('natdex') || formatid.startsWith(gen + 'nd') ||
			formatid.includes('metronome') || formatid.includes('createmons') || formatid.includes('infinitefusion') || formatid.includes('morebalancedhackmons')
		) modids.push('natdex' as ID);
		if (formatid.includes('letsgo')) modids.push('gen7letsgo' as ID);
		if (formatid.includes('bdsp')) modids.push('gen8bdsp' as ID);
		if (formatid.includes('morebalancedhackmons')) modids.push('gen9morebalancedhackmons' as ID);
		if (formatid.includes('digimon')) modids.push('digimon' as ID);
		// todo: figure out a way to arrange the ids
		const modpid = gen + modids.join('');
		return [modpid as ID, gen as ID, ...modids];
	}
	mod(formatid: ID): ModdedDex {
		const modids = this.parseFormatid(formatid);
		const modpid = modids[0];
		if (modpid === this.currentGen) return this;
		if (!window.BattleTeambuilderTable) return this;
		if (modpid in this.moddedDexes) {
			return this.moddedDexes[modpid];
		}
		this.moddedDexes[modpid] = new ModdedDex(modids);
		return this.moddedDexes[modpid];
	}
	forGen(gen: number) {
		if (!gen) return this;
		return this.mod(`gen${gen}` as ID);
	}
	formatGen(format: string) {
		const formatid = toID(format);
		if (!formatid) return Dex.gen;
		if (!formatid.startsWith('gen')) return 6;
		return parseInt(formatid.charAt(3)) || Dex.gen;
	}
	forFormat(format: string) {
		let dex = Dex.forGen(Dex.formatGen(format));

		const formatid = toID(format).slice(4);
		if (dex.gen === 7 && formatid.includes('letsgo')) {
			dex = Dex.mod('gen7letsgo' as ID);
		}
		if (dex.gen === 8 && formatid.includes('bdsp')) {
			dex = Dex.mod('gen8bdsp' as ID);
		}
		return dex;
	}

	resolveAvatar(avatar: string): string {
		if (window.BattleAvatarNumbers && avatar in BattleAvatarNumbers) {
			avatar = BattleAvatarNumbers[avatar];
		}
		if (avatar.startsWith('#')) {
			return Dex.resourcePrefix + 'sprites/trainers-custom/' + toID(avatar.substr(1)) + '.png';
		}
		if (avatar.includes('.') && window.Config?.server?.registered) {
			// custom avatar served by the server
			let protocol = (Config.server.port === 443) ? 'https' : 'http';
			return protocol + '://' + Config.server.host + ':' + Config.server.port +
				'/avatars/' + encodeURIComponent(avatar).replace(/%3F/g, '?');
		}
		return Dex.resourcePrefix + 'sprites/trainers/' + Dex.sanitizeName(avatar || 'unknown') + '.png';
	}

	/**
	 * This is used to sanitize strings from data files like `moves.js` and
	 * `teambuilder-tables.js`.
	 *
	 * This makes sure untrusted strings can't wreak havoc if someone forgets to
	 * escape it before putting it in HTML.
	 *
	 * None of these characters belong in these files, anyway. (They can be used
	 * in move descriptions, but those are served from `text.js`, which are
	 * definitely always treated as unsanitized.)
	 */
	sanitizeName(name: any) {
		if (!name) return '';
		return ('' + name)
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
			.slice(0, 50);
	}

	prefs(prop: string) {
		// @ts-expect-error this is what I get for calling it Storage...
		return window.Storage?.prefs ? window.Storage.prefs(prop) : window.PS?.prefs?.[prop];
	}

	getShortName(name: string) {
		let shortName = name.replace(/[^A-Za-z0-9]+$/, '');
		if (shortName.includes('(')) {
			shortName += name.slice(shortName.length).replace(/[^()]+/g, '').replace(/\(\)/g, '');
		}
		return shortName;
	}

	getEffect(name: string | null | undefined): PureEffect | Item | Ability | Move {
		name = (name || '').trim();
		if (name.substr(0, 5) === 'item:') {
			return Dex.items.get(name.substr(5).trim());
		} else if (name.substr(0, 8) === 'ability:') {
			return Dex.abilities.get(name.substr(8).trim());
		} else if (name.substr(0, 5) === 'move:') {
			return Dex.moves.get(name.substr(5).trim());
		}
		let id = toID(name);
		return new PureEffect(id, name);
	}

	moves = {
		get: (nameOrMove: string | Move | null | undefined): Move => {
			if (nameOrMove && typeof nameOrMove !== 'string') {
				// TODO: don't accept Moves here
				return nameOrMove;
			}
			let name = nameOrMove || '';
			let id = toID(nameOrMove);
			if (window.BattleAliases && id in BattleAliases) {
				name = BattleAliases[id];
				id = toID(name);
			}
			if (!window.BattleMovedex) window.BattleMovedex = {};
			let data = window.BattleMovedex[id];
			if (data && typeof data.exists === 'boolean') return data;

			if (!data && id.substr(0, 11) === 'hiddenpower' && id.length > 11) {
				let [, hpWithType, hpPower] = /([a-z]*)([0-9]*)/.exec(id)!;
				data = {
					...(window.BattleMovedex[hpWithType] || {}),
					basePower: Number(hpPower) || 60,
				};
			}
			if (!data && id.substr(0, 6) === 'return' && id.length > 6) {
				data = {
					...(window.BattleMovedex['return'] || {}),
					basePower: Number(id.slice(6)),
				};
			}
			if (!data && id.substr(0, 11) === 'frustration' && id.length > 11) {
				data = {
					...(window.BattleMovedex['frustration'] || {}),
					basePower: Number(id.slice(11)),
				};
			}

			if (!data) data = { exists: false };
			let move = new Move(id, name, data);
			if (move.exists) window.BattleMovedex[id] = move;
			return move;
		},
	};

	getGen3Category(type: string) {
		return [
			'Fire', 'Water', 'Grass', 'Electric', 'Ice', 'Psychic', 'Dark', 'Dragon',
		].includes(type) ? 'Special' : 'Physical';
	}

	items = {
		get: (nameOrItem: string | Item | null | undefined): Item => {
			if (nameOrItem && typeof nameOrItem !== 'string') {
				// TODO: don't accept Items here
				return nameOrItem;
			}
			let name = nameOrItem || '';
			let id = toID(nameOrItem);
			if (window.BattleAliases && id in BattleAliases) {
				name = BattleAliases[id];
				id = toID(name);
			}
			if (!window.BattleItems) window.BattleItems = {};
			let data = window.BattleItems[id];
			if (data && typeof data.exists === 'boolean') return data;
			if (!data) data = { exists: false };
			let item = new Item(id, name, data);
			if (item.exists) window.BattleItems[id] = item;
			return item;
		},
	};

	abilities = {
		get: (nameOrAbility: string | Ability | null | undefined): Ability => {
			if (nameOrAbility && typeof nameOrAbility !== 'string') {
				// TODO: don't accept Abilities here
				return nameOrAbility;
			}
			let name = nameOrAbility || '';
			let id = toID(nameOrAbility);
			if (window.BattleAliases && id in BattleAliases) {
				name = BattleAliases[id];
				id = toID(name);
			}
			if (!window.BattleAbilities) window.BattleAbilities = {};
			let data = window.BattleAbilities[id];
			if (data && typeof data.exists === 'boolean') return data;
			if (!data) data = { exists: false };
			let ability = new Ability(id, name, data);
			if (ability.exists) window.BattleAbilities[id] = ability;
			return ability;
		},
	};

	species = {
		get: (nameOrSpecies: string | Species | null | undefined): Species => {
			if (nameOrSpecies && typeof nameOrSpecies !== 'string') {
				// TODO: don't accept Species' here
				return nameOrSpecies;
			}
			let name = nameOrSpecies || '';
			let id = toID(nameOrSpecies);
			let formid = id;
			if (!window.BattlePokedexAltForms) window.BattlePokedexAltForms = {};
			if (formid in window.BattlePokedexAltForms) return window.BattlePokedexAltForms[formid];
			if (window.BattleAliases && id in BattleAliases) {
				name = BattleAliases[id];
				id = toID(name);
			} else if (window.BattlePokedex && !(id in BattlePokedex) && window.BattleBaseSpeciesChart) {
				for (const baseSpeciesId of BattleBaseSpeciesChart) {
					if (formid.startsWith(baseSpeciesId)) {
						id = baseSpeciesId;
						break;
					}
				}
			}
			if (!window.BattlePokedex) window.BattlePokedex = {};
			let data = window.BattlePokedex[id];

			let species: Species;
			if (data && typeof data.exists === 'boolean') {
				species = data;
			} else {
				if (!data) data = { exists: false };
				if (!data.tier && id.endsWith('totem')) {
					data.tier = this.species.get(id.slice(0, -5)).tier;
				}
				if (!data.tier && data.baseSpecies && toID(data.baseSpecies) !== id) {
					data.tier = this.species.get(data.baseSpecies).tier;
				}
				data.nfe = data.id === 'dipplin' || !!(data as Species).evos?.some(evo => {
					const evoSpecies = this.species.get(evo);
					return !evoSpecies.isNonstandard || evoSpecies.isNonstandard === data.isNonstandard ||
						// Pokemon with Hisui evolutions
						evoSpecies.isNonstandard === "Unobtainable";
				});
				species = new Species(id, name, data);
				if (species.exists) window.BattlePokedex[id] = species;
			}

			if (species.cosmeticFormes) {
				for (const forme of species.cosmeticFormes) {
					if (toID(forme) === formid) {
						species = new Species(formid, name, {
							...species,
							name: forme,
							forme: forme.slice(species.name.length + 1),
							baseForme: "",
							baseSpecies: species.name,
							otherFormes: null,
						});
						window.BattlePokedexAltForms[formid] = species;
						break;
					}
				}
			}

			return species;
		},
		// for species oms
		getFromPokemon: (pokemon: Pokemon | ServerPokemon | Dex.PokemonSet): Species => {
			const species = (pokemon as Dex.PokemonSet).species || (pokemon as (Pokemon | ServerPokemon)).speciesForme;
			return this.species.get(species);
		},
	};

	types = {
		allCache: null as Type[] | null,
		namesCache: null as Dex.TypeName[] | null,
		get: (type: any): Type => {
			if (!type || typeof type === 'string') {
				const id = toID(type) as string;
				const name = id.substr(0, 1).toUpperCase() + id.substr(1);
				type = window.BattleTypeChart?.[id] || {};
				if (type.damageTaken) type.exists = true;
				if (!type.id) type.id = id;
				if (!type.name) type.name = name;
				if (!type.effectType) {
					type.effectType = 'Type';
				}
			}
			return type;
		},
		all: (): readonly Type[] => {
			if (this.types.allCache) return this.types.allCache;
			const types = [];
			for (const id in (window.BattleTypeChart || {})) {
				types.push(Dex.types.get(id));
			}
			if (types.length) this.types.allCache = types;
			return types;
		},
		names: (): readonly Dex.TypeName[] => {
			if (this.types.namesCache) return this.types.namesCache;
			const names = this.types.all().map(type => type.name as Dex.TypeName);
			names.splice(names.indexOf('Stellar'), 1);
			if (names.length) this.types.namesCache = names;
			return names;
		},
		isName: (name: string | null): boolean => {
			const id = toID(name);
			if (name !== id.substr(0, 1).toUpperCase() + id.substr(1)) return false;
			return window.BattleTypeChart?.hasOwnProperty(id);
		},
	};

	hasAbility(species: Species, ability: string) {
		for (const i in species.abilities) {
			if (ability === species.abilities[i as '0']) return true;
		}
		return false;
	}

	loadSpriteData(gen: 'xy' | 'bw') {
		if (this.loadedSpriteData[gen]) return;
		this.loadedSpriteData[gen] = 1;

		let path = $('script[src*="pokedex-mini.js"]').attr('src') || '';
		let qs = '?' + (path.split('?')[1] || '');
		path = ((/.+?(?=data\/pokedex-mini\.js)/.exec(path)) || [])[0] || '';

		let el = document.createElement('script');
		el.src = path + 'data/pokedex-mini-bw.js' + qs;
		document.getElementsByTagName('body')[0].appendChild(el);
	}
	getSpriteData(pokemon: Pokemon | Species | string, isFront: boolean, options: {
		gen?: number,
		shiny?: boolean,
		gender?: Dex.GenderName,
		afd?: boolean,
		noScale?: boolean,
		mod?: string,
		dynamax?: boolean,
	} = { gen: 6 }) {
		const mechanicsGen = options.gen || 6;
		let isDynamax = !!options.dynamax;
		if (pokemon instanceof Pokemon) {
			if (options.mod === 'infinitefusion' && !Dex.prefs('noif')) return this.getIFSpriteData(pokemon, isFront, options);
			if (pokemon.volatiles.transform) {
				options.shiny = pokemon.volatiles.transform[2];
				options.gender = pokemon.volatiles.transform[3];
			} else {
				options.shiny = pokemon.shiny;
				options.gender = pokemon.gender;
			}
			let isGigantamax = false;
			if (pokemon.volatiles.dynamax) {
				if (pokemon.volatiles.dynamax[1]) {
					isGigantamax = true;
				} else if (options.dynamax !== false) {
					isDynamax = true;
				}
			}
			pokemon = pokemon.getSpeciesForme() + (isGigantamax ? '-Gmax' : '');
		}
		const species = Dex.species.get(pokemon);
		// Gmax sprites are already extremely large, so we don't need to double.
		if (species.name.endsWith('-Gmax')) isDynamax = false;
		let spriteData = {
			gen: mechanicsGen,
			w: 96,
			h: 96,
			y: 0,
			url: Dex.resourcePrefix + 'sprites/',
			pixelated: true,
			isFrontSprite: false,
			cryurl: '',
			shiny: options.shiny,
		};
		let name = species.spriteid;
		let dir;
		let facing;
		if (isFront) {
			spriteData.isFrontSprite = true;
			dir = '';
			facing = 'front';
		} else {
			dir = '-back';
			facing = 'back';
		}

		// Decide which gen sprites to use.
		//
		// There are several different generations we care about here:
		//
		//   - mechanicsGen: the generation number of the mechanics and battle (options.gen)
		//   - graphicsGen: the generation number of sprite/field graphics the user has requested.
		//     This will default to mechanicsGen, but may be altered depending on user preferences.
		//   - spriteData.gen: the generation number of a the specific Pokemon sprite in question.
		//     This defaults to graphicsGen, but if the graphicsGen doesn't have a sprite for the Pokemon
		//     (eg. Darmanitan in graphicsGen 2) then we go up gens until it exists.
		//
		let graphicsGen = mechanicsGen;
		if (Dex.prefs('nopastgens')) graphicsGen = 6;
		if (Dex.prefs('bwgfx') && graphicsGen >= 6) graphicsGen = 5;
		spriteData.gen = Math.max(graphicsGen, Math.min(species.gen, 5));
		const baseDir = ['', 'gen1', 'gen2', 'gen3', 'gen4', 'gen5', '', '', '', ''][spriteData.gen];

		let animationData = null;
		let miscData = null;
		let speciesid = species.id;
		if (species.isTotem) speciesid = toID(name);
		if (baseDir === '' && window.BattlePokemonSprites) {
			animationData = BattlePokemonSprites[speciesid];
		}
		if (baseDir === 'gen5' && window.BattlePokemonSpritesBW) {
			animationData = BattlePokemonSpritesBW[speciesid];
		}
		if (window.BattlePokemonSprites) miscData = BattlePokemonSprites[speciesid];
		if (!miscData && window.BattlePokemonSpritesBW) miscData = BattlePokemonSpritesBW[speciesid];
		if (!animationData) animationData = {};
		if (!miscData) miscData = {};

		if (miscData.num !== 0 && miscData.num > -5000) {
			let baseSpeciesid = toID(species.baseSpecies);
			spriteData.cryurl = 'audio/cries/' + baseSpeciesid;
			let formeid = species.formeid;
			if (species.isMega || formeid && (
				formeid === '-crowned' ||
				formeid === '-eternal' ||
				formeid === '-eternamax' ||
				formeid === '-four' ||
				formeid === '-hangry' ||
				formeid === '-hero' ||
				formeid === '-lowkey' ||
				formeid === '-noice' ||
				formeid === '-primal' ||
				formeid === '-rapidstrike' ||
				formeid === '-roaming' ||
				formeid === '-school' ||
				formeid === '-sky' ||
				formeid === '-starter' ||
				formeid === '-super' ||
				formeid === '-therian' ||
				formeid === '-unbound' ||
				baseSpeciesid === 'calyrex' ||
				baseSpeciesid === 'kyurem' ||
				baseSpeciesid === 'cramorant' ||
				baseSpeciesid === 'indeedee' ||
				baseSpeciesid === 'lycanroc' ||
				baseSpeciesid === 'necrozma' ||
				baseSpeciesid === 'oinkologne' ||
				baseSpeciesid === 'oricorio' ||
				baseSpeciesid === 'slowpoke' ||
				baseSpeciesid === 'tatsugiri' ||
				baseSpeciesid === 'zygarde'
			)) {
				spriteData.cryurl += formeid;
			}
			spriteData.cryurl += '.mp3';
		}

		if (options.shiny && mechanicsGen > 1) dir += '-shiny';

		// Mod Cries
		if (options.mod) {
			spriteData.cryurl = `sprites/${options.mod}/audio/${toID(species.baseSpecies)}`;
			spriteData.cryurl += '.mp3';
		}

		if (animationData[facing + 'f'] && options.gender === 'F') facing += 'f';
		let allowAnim = !Dex.prefs('noanim') && !Dex.prefs('nogif');
		if (allowAnim && spriteData.gen >= 6) spriteData.pixelated = false;
		if (allowAnim && animationData[facing] && spriteData.gen >= 5) {
			if (facing.endsWith('f')) name += '-f';
			dir = baseDir + 'ani' + dir;

			spriteData.w = animationData[facing].w;
			spriteData.h = animationData[facing].h;
			spriteData.url += dir + '/' + name + '.gif';
		} else {
			// There is no entry or enough data in pokedex-mini.js
			// Handle these in case-by-case basis; either using BW sprites or matching the played gen.
			dir = (baseDir || 'gen5') + dir;

			// Gender differences don't exist prior to Gen 4,
			// so there are no sprites for it
			if (spriteData.gen >= 4 && miscData['frontf'] && options.gender === 'F') {
				name += '-f';
			}

			spriteData.url += dir + '/' + name + '.png';
		}

		if (!options.noScale) {
			if (graphicsGen > 4) {
				// no scaling
			} else if (spriteData.isFrontSprite) {
				spriteData.w *= 2;
				spriteData.h *= 2;
				spriteData.y += -16;
			} else {
				// old gen backsprites are multiplied by 1.5x by the 3D engine
				spriteData.w *= 2 / 1.5;
				spriteData.h *= 2 / 1.5;
				spriteData.y += -11;
			}
			if (spriteData.gen <= 2) spriteData.y += 2;
		}
		if (isDynamax && !options.noScale) {
			spriteData.w *= 2;
			spriteData.h *= 2;
			spriteData.y += -22;
		} else if (species.isTotem && !options.noScale) {
			spriteData.w *= 1.5;
			spriteData.h *= 1.5;
			spriteData.y += -11;
		}

		return spriteData;
	}

	getIFSpriteData(pokemon: Pokemon | Species | string, isFront: boolean, options: {
		gen?: number,
		shiny?: boolean,
		gender?: Dex.GenderName,
		afd?: boolean,
		noScale?: boolean,
		mod?: string,
		dynamax?: boolean,
	} = { gen: 6 }): {
			gen: number,
			w: number,
			h: number,
			y: number,
			url: string,
			pixelated: boolean,
			isFrontSprite: boolean,
			cryurl: string,
			shiny?: boolean,
		} {
		// battle sprites are 96x96, while teambuilder sprites are 120x120
		let spriteData = {
			gen: options.gen || 9,
			w: 96,
			h: 96,
			y: 0,
			url: Dex.resourcePrefix + 'sprites/infinitefusion-battle/',
			pixelated: true,
			isFrontSprite: isFront,
			cryurl: '',
			shiny: false,
		};
		if (!(pokemon instanceof Pokemon)) {
			spriteData.url += '1/1.1.png';
			return spriteData;
		}
		if (pokemon.volatiles.transform) return this.getSpriteData(pokemon.volatiles.transform[1], isFront, options);
		let headname = pokemon.details.split(', ').find(value => value.startsWith('headname:'));
		headname = headname ? headname.slice(9) : pokemon.name;
		// const nickname = pokemon.name || headname;
		const headSpecies = Dex.species.get(headname);
		const bodySpecies = Dex.species.get(pokemon.speciesForme);
		if (!headSpecies.exists) return this.getSpriteData(pokemon, isFront, { ...options, mod: undefined });
		let headNum = headSpecies.num;
		let bodyNum = bodySpecies.num;
		// only these two are needed, currently
		const specialFusions: { [k: string]: number[] } = {
			'kyuremblack': [644, 646],
			'kyuremwhite': [643, 646],
		};
		if (headSpecies.id in specialFusions) [headNum, bodyNum] = specialFusions[headSpecies.id];
		spriteData.url += `${headNum}/${headNum}.${bodyNum}.png`;
		spriteData.cryurl = `audio/cries/${headSpecies.id}.mp3`;

		const request = new XMLHttpRequest();
		let found = false;
		request.onreadystatechange = function () {
			if (request.readyState === 4) {
				if (request.status === 200) {
					found = true;
				}
			}
		};
		try {
			request.open('HEAD', spriteData.url, false);
			request.send();
		} catch {}
		if (!found) return this.getSpriteData(pokemon, isFront, { ...options, mod: undefined });

		if (!options.noScale) {
			if (spriteData.isFrontSprite) {
				// 2 is too big i think
				spriteData.w *= 1;
				spriteData.h *= 1;
				spriteData.y += -10;
			} else {
				// old gen backsprites are multiplied by 1.5x by the 3D engine
				// just use my own size lol
				spriteData.w *= 1.5;
				spriteData.h *= 1.5;
				spriteData.y += -5;
			}
		}

		return spriteData;
	}

	getPokemonIconNum(id: ID, isFemale?: boolean, facingLeft?: boolean) {
		let num = 0;
		if (window.BattlePokemonSprites?.[id]?.num) {
			num = BattlePokemonSprites[id].num;
		} else if (window.BattlePokedex?.[id]?.num) {
			num = BattlePokedex[id].num;
		}
		if (num < 0) num = 0;
		if (num > 1025) num = 0;

		if (window.BattlePokemonIconIndexes?.[id]) {
			num = BattlePokemonIconIndexes[id];
		}

		if (isFemale) {
			if (['unfezant', 'frillish', 'jellicent', 'meowstic', 'pyroar'].includes(id)) {
				num = BattlePokemonIconIndexes[id + 'f'];
			}
		}
		if (facingLeft) {
			if (BattlePokemonIconIndexesLeft[id]) {
				num = BattlePokemonIconIndexesLeft[id];
			}
		}
		return num;
	}

	getPokemonIcon(pokemon: string | Pokemon | ServerPokemon | Dex.PokemonSet | null, facingLeft?: boolean) {
		if (pokemon === 'pokeball') {
			return `background:transparent url(${Dex.resourcePrefix}sprites/pokemonicons-pokeball-sheet.png) no-repeat scroll -0px 4px`;
		} else if (pokemon === 'pokeball-statused') {
			return `background:transparent url(${Dex.resourcePrefix}sprites/pokemonicons-pokeball-sheet.png) no-repeat scroll -40px 4px`;
		} else if (pokemon === 'pokeball-fainted') {
			return `background:transparent url(${Dex.resourcePrefix}sprites/pokemonicons-pokeball-sheet.png) no-repeat scroll -80px 4px;opacity:.4;filter:contrast(0)`;
		} else if (pokemon === 'pokeball-none') {
			return `background:transparent url(${Dex.resourcePrefix}sprites/pokemonicons-pokeball-sheet.png) no-repeat scroll -80px 4px`;
		}

		let id = toID(pokemon);
		if (!pokemon || typeof pokemon === 'string') pokemon = null;
		// @ts-expect-error safe, but too lazy to cast
		if (pokemon?.speciesForme) id = toID(pokemon.speciesForme);
		// @ts-expect-error safe, but too lazy to cast
		if (pokemon?.species) id = toID(pokemon.species);
		// @ts-expect-error safe, but too lazy to cast
		if (pokemon?.volatiles?.formechange && !pokemon.volatiles.transform) {
			// @ts-expect-error safe, but too lazy to cast
			id = toID(pokemon.volatiles.formechange[1]);
		}
		let num = this.getPokemonIconNum(id, pokemon?.gender === 'F', facingLeft);

		let top = Math.floor(num / 12) * 30;
		let left = (num % 12) * 40;
		let fainted = ((pokemon as Pokemon | ServerPokemon)?.fainted ?
			`;opacity:.3;filter:grayscale(100%) brightness(.5)` : ``);
		return `background:transparent url(${Dex.resourcePrefix}sprites/pokemonicons-sheet.png?v18) no-repeat scroll -${left}px -${top}px${fainted}`;
	}

	getTeambuilderSpriteData(pokemon: any, gen = 0): TeambuilderSpriteData {
		let id = toID(pokemon.species);
		let spriteid = pokemon.spriteid;
		let species = Dex.species.get(pokemon.species);
		if (pokemon.species && !spriteid) {
			spriteid = species.spriteid || toID(pokemon.species);
		}
		if (species.exists === false) {
			// todo: one day move this to moddeddex
			let modSpecies = Dex.mod('digimon' as ID).species.get(pokemon.species);
			if (modSpecies.exists === true) {
				const modSpriteData: TeambuilderSpriteData = {
					spriteid: modSpecies.id,
					spriteDir: 'sprites/digimon/dex',
					x: -6,
					y: 0,
				};
				if ([
					'andromon', 'angewomon', 'bakemon', 'darktyranomon', 'geremon', 'hiandromon', 'numemon',
					'rosemon',
				].includes(id)) modSpriteData.y = 14;
				if ([
					'agumon', 'agumonblack', 'blackwargreymon', 'boltmon', 'centalmon', 'deathmeramon', 'diablomon',
					'garudamon', 'grappuleomon', 'ladydevimon', 'leomon', 'mastertyranomon', 'megaseadramon', 'plotmon',
					'vamdemon', 'wargreymon', 'weregarurumon', 'weregarurumonblack', 'yukiagumon',
				].includes(id)) modSpriteData.y = 7;
				return modSpriteData;
			}
			modSpecies = Dex.mod('createmons' as ID).species.get(pokemon.species);
			if (modSpecies.exists === true) {
				const modSpriteData: TeambuilderSpriteData = {
					spriteid: modSpecies.id,
					spriteDir: 'sprites/dex',
					x: 0,
					y: 0,
				};
				if (pokemon.shiny) modSpriteData.shiny = true;
				return modSpriteData;
			}
			return { spriteDir: 'sprites/gen5', spriteid: '0', x: 10, y: 5 };
		}
		const spriteData: TeambuilderSpriteData = {
			spriteid,
			spriteDir: 'sprites/dex',
			x: -2,
			y: -3,
		};
		if (pokemon.shiny) spriteData.shiny = true;
		if (Dex.prefs('nopastgens')) gen = 6;
		if (Dex.prefs('bwgfx') && gen > 5) gen = 5;
		let xydexExists = (!species.isNonstandard || species.isNonstandard === 'Past' || species.isNonstandard === 'CAP') || [
			"pikachustarter", "eeveestarter", "meltan", "melmetal", "pokestarufo", "pokestarufo2", "pokestarbrycenman", "pokestarmt", "pokestarmt2", "pokestargiant", "pokestarhumanoid", "pokestarmonster", "pokestarf00", "pokestarf002", "pokestarspirit",
		].includes(species.id);
		if (species.gen >= 8 && species.isNonstandard !== 'CAP') xydexExists = false;
		if ((!gen || gen >= 6) && xydexExists) {
			if (species.gen >= 7) {
				spriteData.x = -6;
				spriteData.y = -7;
			} else if (id.substr(0, 6) === 'arceus') {
				spriteData.x = -2;
				spriteData.y = 7;
			} else if (id === 'garchomp') {
				spriteData.x = -2;
				spriteData.y = 2;
			} else if (id === 'garchompmega') {
				spriteData.x = -2;
				spriteData.y = 0;
			}
			return spriteData;
		}
		spriteData.spriteDir = 'sprites/gen5';
		if (gen <= 1 && species.gen <= 1) spriteData.spriteDir = 'sprites/gen1';
		else if (gen <= 2 && species.gen <= 2) spriteData.spriteDir = 'sprites/gen2';
		else if (gen <= 3 && species.gen <= 3) spriteData.spriteDir = 'sprites/gen3';
		else if (gen <= 4 && species.gen <= 4) spriteData.spriteDir = 'sprites/gen4';
		spriteData.x = 10;
		spriteData.y = 5;
		return spriteData;
	}

	// Nihilslave: get IF Sprites
	getIFTeambuilderSpriteData(pokemon: any, gen = 0): TeambuilderSpriteData {
		let headSpecies = Dex.species.get(pokemon.name);
		let bodySpecies = Dex.species.get(pokemon.species);
		const headNum = headSpecies.num;
		const bodyNum = bodySpecies.num;
		if (!headSpecies.exists) return this.getTeambuilderSpriteData(pokemon, gen);
		const spriteData: TeambuilderSpriteData = {
			spriteid: `${headNum}/${headNum}.${bodyNum}`,
			spriteDir: 'sprites/infinitefusion',
			x: -2,
			y: -3,
		};
		const url = Dex.resourcePrefix + 'sprites/infinitefusion/' + spriteData.spriteid + '.png';
		const request = new XMLHttpRequest();
		request.onreadystatechange = function () {
			if (request.readyState === 4) {
				if (request.status === 200) {
					spriteData.shiny = false;
				} else {
					spriteData.shiny = true;
				}
			}
		};
		try {
			request.open('HEAD', url, false);
			request.send();
		} catch {}

		return spriteData;
	}

	getTeambuilderSprite(pokemon: any, gen = 0) {
		if (!pokemon) return '';
		// Nihilslave: for IF
		const data = (pokemon.isIF && !Dex.prefs('noif')) ?
			this.getIFTeambuilderSpriteData(pokemon, gen) : this.getTeambuilderSpriteData(pokemon, gen);
		if (pokemon.isIF && data.shiny) return data.spriteid.split('/')[1];
		const shiny = (data.shiny ? '-shiny' : '');
		return `background-image:url(${Dex.resourcePrefix}${data.spriteDir}${shiny}/${data.spriteid}.png);background-position:${data.x}px ${data.y}px;background-repeat:no-repeat`;
	}

	getItemIcon(item: any) {
		let num = 0;
		if (typeof item === 'string' && exports.BattleItems) item = exports.BattleItems[toID(item)];
		if (item?.spritenum) num = item.spritenum;

		let top = Math.floor(num / 16) * 24;
		let left = (num % 16) * 24;
		return `background:transparent url(${Dex.resourcePrefix}sprites/itemicons-sheet.png?v1) no-repeat scroll -${left}px -${top}px`;
	}

	getTypeIcon(type: string | null, b?: boolean) { // b is just for utilichart.js
		type = this.types.get(type).name;
		if (!type) type = '???';
		let sanitizedType = type.replace(/\?/g, '%3f');
		return `<img src="${Dex.resourcePrefix}sprites/types/${sanitizedType}.png" alt="${type}" height="14" width="32" class="pixelated${b ? ' b' : ''}" />`;
	}

	getCategoryIcon(category: string | null) {
		const categoryID = toID(category);
		let sanitizedCategory = '';
		switch (categoryID) {
		case 'physical':
		case 'special':
		case 'status':
			sanitizedCategory = categoryID.charAt(0).toUpperCase() + categoryID.slice(1);
			break;
		default:
			sanitizedCategory = 'undefined';
			break;
		}
		return `<img src="${Dex.resourcePrefix}sprites/categories/${sanitizedCategory}.png" alt="${sanitizedCategory}" height="14" width="32" class="pixelated" />`;
	}

	getPokeballs() {
		if (this.pokeballs) return this.pokeballs;
		this.pokeballs = [];
		if (!window.BattleItems) window.BattleItems = {};
		for (const data of Object.values<AnyObject>(window.BattleItems)) {
			if (!data.isPokeball) continue;
			this.pokeballs.push(data.name);
		}
		return this.pokeballs;
	}

	getTierSetTable() {
		return window.BattleTeambuilderTable;
	}
	getLearnsetTable() {
		return window.BattleTeambuilderTable;
	}

	getMovedex() {
		return window.BattleMovedex;
	}

	getTierSet() {
		const table = this.getTierSetTable();
		if (!table.tierSet) {
			table.tierSet = table.tiers.map((r: any) => {
				if (typeof r === 'string') return ['pokemon', r];
				return [r[0], r[1]];
			});
			table.tiers = null;
		}
		return table.tierSet.slice(table.formatSlices.AG);
	}

	getItemSet() {
		let table = window.BattleTeambuilderTable;
		if (!table.itemSet) {
			table.itemSet = table.items.map((r: any) => {
				if (typeof r === 'string') {
					return ['item', r];
				}
				return [r[0], r[1]];
			});
			table.items = null;
		}
		return table.itemSet;
	}

	firstLearnsetid(speciesid: ID) {
		const table = this.getLearnsetTable();
		if (speciesid in table.learnsets) return speciesid;
		const species = this.species.get(speciesid);
		if (!species.exists) return '' as ID;

		let baseLearnsetid = toID(species.baseSpecies);
		if (typeof species.battleOnly === 'string' && species.battleOnly !== species.baseSpecies) {
			baseLearnsetid = toID(species.battleOnly);
		}
		if (baseLearnsetid in table.learnsets) return baseLearnsetid;
		return '' as ID;
	}
	nextLearnsetid(learnsetid: ID, speciesid: ID) {
		if (learnsetid === 'lycanrocdusk' || (speciesid === 'rockruff' && learnsetid === 'rockruff')) {
			return 'rockruffdusk' as ID;
		}
		const lsetSpecies = this.species.get(learnsetid);
		if (!lsetSpecies.exists) return '' as ID;

		if (lsetSpecies.id === 'gastrodoneast') return 'gastrodon' as ID;
		if (lsetSpecies.id === 'pumpkaboosuper') return 'pumpkaboo' as ID;
		if (lsetSpecies.id === 'sinisteaantique') return 'sinistea' as ID;

		const next = lsetSpecies.battleOnly || lsetSpecies.changesFrom || lsetSpecies.prevo;
		if (next) return toID(next);

		return '' as ID;
	}
	eggMovesOnly(child: ID, father: ID) {
		if (this.species.get(child).baseSpecies === this.species.get(father).baseSpecies) return false;
		const baseSpecies = father;
		while (father) {
			if (child === father) return false;
			father = this.nextLearnsetid(father, baseSpecies);
		}
		return true;
	}
	canLearn(speciesid: ID, moveid: ID) {
		const move = this.moves.get(moveid);
		let learnsetid = this.firstLearnsetid(speciesid);
		while (learnsetid) {
			const table = this.getLearnsetTable();
			let learnset = table.learnsets[learnsetid];
			const eggMovesOnly = this.eggMovesOnly(learnsetid, speciesid);
			// sketch
			if (learnset && ('sketch' in learnset) && learnset['sketch'].includes(this.learnsetGenchar) &&
				(!eggMovesOnly || learnset['sketch'].includes('e'))
			) {
				if (!move.flags['nosketch'] && !move.isMax && !move.isZ && !move.isNonstandard) return true;
			}
			// regular
			if (learnset && (moveid in learnset) && learnset[moveid].includes(this.learnsetGenchar) &&
				(!eggMovesOnly || learnset[moveid].includes('e'))
			) {
				return true;
			}
			learnsetid = this.nextLearnsetid(learnsetid, speciesid);
		}
		return false;
	}
	getLearnsetMoves(pokemon: Dex.PokemonSet) {
		const moveDex = window.BattleMovedex;
		const moves: string[] = [];
		for (const id in moveDex) {
			if (this.canLearn(toID(pokemon.species), id as ID)) moves.push(id);
		}
		return moves;
	}

	getTypeSet() {
		const results: SearchRow[] = [];
		for (let id in window.BattleTypeChart) {
			results.push(['type', id as ID]);
		}
		return results;
	}
};

export class ModdedDex {
	readonly gen: number;
	readonly modid: ID[];
	readonly cache = {
		Moves: {} as { [k: string]: Move },
		Items: {} as { [k: string]: Item },
		Abilities: {} as { [k: string]: Ability },
		Species: {} as { [k: string]: Species },
		Types: {} as { [k: string]: Dex.Effect },
	};
	pokeballs: string[] | null = null;
	constructor(modids: ID[]) {
		this.gen = parseInt(modids[1].slice(3), 10);
		this.modid = modids.slice(2);
	}
	moves = {
		get: (name: string): Move => {
			let id = toID(name);
			if (window.BattleAliases && id in BattleAliases) {
				name = BattleAliases[id];
				id = toID(name);
			}
			if (this.cache.Moves.hasOwnProperty(id)) return this.cache.Moves[id];

			let data = { ...Dex.moves.get(name) };

			for (let i = Dex.gen - 1; i >= this.gen; i--) {
				const table = window.BattleTeambuilderTable[`gen${i}`];
				if (id in table.overrideMoveData) {
					Object.assign(data, table.overrideMoveData[id]);
				}
			}
			if (this.gen <= 3 && data.category !== 'Status') {
				data.category = Dex.getGen3Category(data.type);
			}
			for (const mid of this.modid) {
				if (ModModifier[mid]?.movesMod) ModModifier[mid].movesMod(data, this);
			}

			const move = new Move(id, name, data);
			if (move.exists) this.cache.Moves[id] = move;
			return move;
		},
	};

	items = {
		get: (name: string): Item => {
			let id = toID(name);
			if (window.BattleAliases && id in BattleAliases) {
				name = BattleAliases[id];
				id = toID(name);
			}
			if (this.cache.Items.hasOwnProperty(id)) return this.cache.Items[id];

			let data = { ...Dex.items.get(name) };

			for (let i = Dex.gen - 1; i >= this.gen; i--) {
				const table = window.BattleTeambuilderTable[`gen${i}`];
				if (id in table.overrideItemData) {
					Object.assign(data, table.overrideItemData[id]);
				}
			}
			for (const mid of this.modid) {
				if (ModModifier[mid]?.itemsMod) ModModifier[mid].itemsMod(data, this);
			}

			const item = new Item(id, name, data);
			if (item.exists) this.cache.Items[id] = item;
			return item;
		},
	};

	abilities = {
		get: (name: string): Ability => {
			let id = toID(name);
			if (window.BattleAliases && id in BattleAliases) {
				name = BattleAliases[id];
				id = toID(name);
			}
			if (this.cache.Abilities.hasOwnProperty(id)) return this.cache.Abilities[id];

			let data = { ...Dex.abilities.get(name) };

			for (let i = Dex.gen - 1; i >= this.gen; i--) {
				const table = window.BattleTeambuilderTable[`gen${i}`];
				if (id in table.overrideAbilityData) {
					Object.assign(data, table.overrideAbilityData[id]);
				}
			}
			for (const mid of this.modid) {
				if (ModModifier[mid]?.abilitiesMod) ModModifier[mid].abilitiesMod(data, this);
			}

			const ability = new Ability(id, name, data);
			if (ability.exists) this.cache.Abilities[id] = ability;
			return ability;
		},
	};

	species = {
		get: (name: string): Species => {
			let id = toID(name);
			if (window.BattleAliases && id in BattleAliases) {
				name = BattleAliases[id];
				id = toID(name);
			}
			if (this.cache.Species.hasOwnProperty(id)) return this.cache.Species[id];

			let data = { ...Dex.species.get(name) };

			for (let i = Dex.gen - 1; i >= this.gen; i--) {
				const table = window.BattleTeambuilderTable[`gen${i}`];
				if (id in table.overrideSpeciesData) {
					Object.assign(data, table.overrideSpeciesData[id]);
				}
			}
			if (this.gen < 3) {
				data.abilities = { 0: "No Ability" };
			}
			for (const mid of this.modid) {
				if (ModModifier[mid]?.speciesMod) ModModifier[mid].speciesMod(data, this);
			}
			if (!data.tier && id.endsWith('totem')) {
				data.tier = this.species.get(id.slice(0, -5)).tier;
			}
			if (!data.tier && data.baseSpecies && toID(data.baseSpecies) !== id) {
				data.tier = this.species.get(data.baseSpecies).tier;
			}
			if (data.gen > this.gen) data.tier = 'Illegal';
			data.nfe = data.id === 'dipplin' || !!data.evos?.some(evo => {
				const evoSpecies = this.species.get(evo);
				return !evoSpecies.isNonstandard || evoSpecies.isNonstandard === data.isNonstandard ||
					// Pokemon with Hisui evolutions
					evoSpecies.isNonstandard === "Unobtainable";
			});

			const species = new Species(id, name, data);
			if (species.exists) this.cache.Species[id] = species;
			return species;
		},
		// for species oms
		getFromPokemon: (pokemon: Pokemon | ServerPokemon | Dex.PokemonSet, extra?: any): Species => {
			for (const mid of this.modid) {
				if (ModModifier[mid]?.ModifySpecies) return ModModifier[mid].ModifySpecies(pokemon, this, extra);
			}
			const species = (pokemon as Dex.PokemonSet).species || (pokemon as (Pokemon | ServerPokemon)).speciesForme;
			return this.species.get(species);
		},
	};

	types = {
		namesCache: null as readonly Dex.TypeName[] | null,
		names: (): readonly Dex.TypeName[] => {
			if (this.types.namesCache) return this.types.namesCache;
			const names = Dex.types.names();
			if (!names.length) return [];
			const curNames = [...names];
			// if (this.gen < 9) curNames.splice(curNames.indexOf('Stellar'), 1);
			if (this.gen < 6) curNames.splice(curNames.indexOf('Fairy'), 1);
			if (this.gen < 2) curNames.splice(curNames.indexOf('Dark'), 1);
			if (this.gen < 2) curNames.splice(curNames.indexOf('Steel'), 1);
			this.types.namesCache = curNames;
			return curNames;
		},
		get: (name: string): Dex.Type => {
			const id = toID(name);
			name = id.substr(0, 1).toUpperCase() + id.substr(1);

			if (this.cache.Types.hasOwnProperty(id)) return this.cache.Types[id];

			let data = { ...Dex.types.get(name) };

			for (let i = 7; i >= this.gen; i--) {
				const table = window.BattleTeambuilderTable[`gen${i}`];
				if (id in table.removeType) {
					data.exists = false;
					// don't bother correcting its attributes given it doesn't exist
					break;
				}
				if (id in table.overrideTypeChart) {
					data = { ...data, ...table.overrideTypeChart[id] };
				}
			}
			for (const mid of this.modid) {
				if (ModModifier[mid]?.typesMod) ModModifier[mid].typesMod(data);
			}

			if (data.exists) this.cache.Types[id] = data;
			return data;
		},
	};

	getPokeballs() {
		if (this.pokeballs) return this.pokeballs;
		this.pokeballs = [];
		if (!window.BattleItems) window.BattleItems = {};
		for (const data of Object.values<AnyObject>(window.BattleItems)) {
			if (data.gen && data.gen > this.gen) continue;
			if (!data.isPokeball) continue;
			this.pokeballs.push(data.name);
		}
		return this.pokeballs;
	}

	getTierSetTable() {
		// todo: this is a really bad way to do so, find a better one
		// todo: i think we need to determine the tierset dynamically for each dex
		let BTTable = window.BattleTeambuilderTable;
		let table = BTTable;
		if (this.gen < Dex.gen) table = BTTable[`gen${this.gen}`];
		if (this.modid.includes('doubles' as ID)) table = BTTable[`gen${this.gen}doubles`];
		if (this.modid.includes('littlecup' as ID)) table = BTTable[`gen${this.gen}lc`];
		if (this.modid.includes('nfe' as ID)) table = BTTable[`gen${this.gen}nfe`];
		if (this.gen === 9 && this.modid.includes('hackmons' as ID)) table = BTTable[`bh`];
		if (this.modid.includes('natdex' as ID)) table = BTTable[`gen${this.gen}natdex`];
		if (this.modid.includes('gen7letsgo' as ID)) table = BTTable['gen7letsgo'];
		if (this.modid.includes('gen8bdsp' as ID)) table = BTTable['gen8bdsp'];
		if (this.modid.includes('digimon' as ID)) table = window.DigimonTable;
		return table;
	}
	getLearnsetTable() {
		if (this.modid.includes('gen7letsgo' as ID)) return window.BattleTeambuilderTable['gen7letsgo'];
		if (this.modid.includes('gen8bdsp' as ID)) return window.BattleTeambuilderTable['gen8bdsp'];
		if (this.modid.includes('digimon' as ID)) return window.DigimonTable;
		return window.BattleTeambuilderTable;
	}

	getMovedex() {
		if (this.modid.includes('digimon' as ID)) return window.DigiMovedex;
		return window.BattleMovedex;
	}

	getTierSet() {
		// part 1: determine table
		const table = this.getTierSetTable();
		if (!table.tierSet) {
			table.tierSet = table.tiers.map((r: any) => {
				if (typeof r === 'string') return ['pokemon', r];
				return [r[0], r[1]];
			});
			table.tiers = null;
		}
		const slices = table.formatSlices;
		let tierSet: SearchRow[] = table.tierSet.slice(slices.AG || slices.Uber || slices.DUber); // remove CAP
		// part 2: filter
		let modified = false;
		for (const mid of this.modid) {
			if (ModModifier[mid]?.ModifyTierSet) {
				tierSet = ModModifier[mid].ModifyTierSet(tierSet, this, slices);
				modified = true;
			}
		}
		if (!modified) {
			if (!this.modid.includes('doubles' as ID)) tierSet = [
				...table.tierSet.slice(slices.OU, slices.UU),
				...table.tierSet.slice(slices.AG, slices.Uber),
				...table.tierSet.slice(slices.Uber, slices.OU),
				...table.tierSet.slice(slices.UU),
			];
			else tierSet = [
				...tierSet.slice(slices.DOU, slices.DUU),
				...tierSet.slice(slices.DUber, slices.DOU),
				...tierSet.slice(slices.DUU),
			];
		}
		return tierSet;
	}

	getItemSet() {
		let table = window.BattleTeambuilderTable;
		const petmods = ['natdex', 'gen8bdsp', 'digimon', 'metronome'];
		for (const mid of this.modid) {
			if (!petmods.includes(mid)) continue;
			let _mid = mid;
			if (['natdex', 'metronome'].includes(_mid)) _mid = `gen${this.gen}${_mid}` as ID;
			table = _mid === ('digimon' as ID) ? window.DigimonTable : window.BattleTeambuilderTable[_mid];
			if (table) break;
		}
		if (this.gen < Dex.gen) table = window.BattleTeambuilderTable[`gen${this.gen}`];
		if (!table.itemSet) {
			table.itemSet = table.items.map((r: any) => {
				if (typeof r === 'string') {
					return ['item', r];
				}
				return [r[0], r[1]];
			});
			table.items = null;
		}
		return table.itemSet;
	}

	// the following may look the same as their counterparts in `Dex`
	// but actually different because of `this`
	firstLearnsetid(speciesid: ID) {
		const table = this.getLearnsetTable();
		if (speciesid in table.learnsets) return speciesid;
		const species = this.species.get(speciesid);
		if (!species.exists) return '' as ID;

		let baseLearnsetid = toID(species.baseSpecies);
		if (typeof species.battleOnly === 'string' && species.battleOnly !== species.baseSpecies) {
			baseLearnsetid = toID(species.battleOnly);
		}
		if (baseLearnsetid in table.learnsets) return baseLearnsetid;
		return '' as ID;
	}
	nextLearnsetid(learnsetid: ID, speciesid: ID) {
		if (learnsetid === 'lycanrocdusk' || (speciesid === 'rockruff' && learnsetid === 'rockruff')) {
			return 'rockruffdusk' as ID;
		}
		const lsetSpecies = this.species.get(learnsetid);
		if (!lsetSpecies.exists) return '' as ID;

		if (lsetSpecies.id === 'gastrodoneast') return 'gastrodon' as ID;
		if (lsetSpecies.id === 'pumpkaboosuper') return 'pumpkaboo' as ID;
		if (lsetSpecies.id === 'sinisteaantique') return 'sinistea' as ID;
		if (lsetSpecies.id === 'tatsugiristretchy') return 'tatsugiri' as ID;

		const next = lsetSpecies.battleOnly || lsetSpecies.changesFrom || lsetSpecies.prevo;
		if (next) return toID(next);

		return '' as ID;
	}
	eggMovesOnly(child: ID, father: ID) {
		if (this.species.get(child).baseSpecies === this.species.get(father).baseSpecies) return false;
		const baseSpecies = father;
		while (father) {
			if (child === father) return false;
			father = this.nextLearnsetid(father, baseSpecies);
		}
		return true;
	}
	canLearn(speciesid: ID, moveid: ID) {
		// Nihilslave: i made some unequivalent changes to this function, mainly about VGC and tradebacks
		const move = this.moves.get(moveid);
		const isNatDex = this.modid.includes('natdex' as ID);
		if (isNatDex && move.isNonstandard && move.isNonstandard !== 'Past' && move.isNonstandard !== 'Unobtainable') {
			return false;
		}
		const gen = this.gen;
		const genCharTable = ['0', '1', '2', '3', '4', '5', 'p', 'q', 'g', 'a'];
		const genChar = (gen === 9 && !isNatDex) ? genCharTable[gen] : `${gen}`;
		let learnsetid = this.firstLearnsetid(speciesid);
		while (learnsetid) {
			const table = this.getLearnsetTable();
			let learnset = table.learnsets[learnsetid];
			const eggMovesOnly = this.eggMovesOnly(learnsetid, speciesid);
			// sketch
			if (learnset && ('sketch' in learnset) && learnset['sketch'].includes(genChar) &&
				(!eggMovesOnly || (learnset['sketch'].includes('e') && gen === 9))
			) {
				if (!move.flags['nosketch'] &&
					!move.isMax && !move.isZ &&
					(!move.isNonstandard || (isNatDex && (move.isNonstandard === 'Past' || move.isNonstandard === 'Unobtainable')))
				) return true;
			}
			// regular
			if (learnset && (moveid in learnset) && learnset[moveid].includes(genChar) &&
				(!eggMovesOnly || (learnset[moveid].includes('e') && gen === 9))
			) {
				return true;
			}
			learnsetid = this.nextLearnsetid(learnsetid, speciesid);
		}
		return false;
	}
	getLearnsetMoves(pokemon: Dex.PokemonSet) {
		const moveDex = this.getMovedex();
		let moves: string[] = [];
		for (const id in moveDex) {
			if (this.canLearn(toID(pokemon.species), id as ID)) moves.push(id);
		}
		for (const mid of this.modid) {
			if (ModModifier[mid]?.ModifyLearnset) moves = ModModifier[mid].ModifyLearnset(pokemon, this, moves);
		}
		return moves;
	}

	getTypeSet() {
		const results: SearchRow[] = [];
		const chart = this.modid.includes('digimon' as ID) ? window.DigiTypeChart : window.BattleTypeChart;
		for (let id in chart) {
			results.push(['type', id as ID]);
		}
		return results;
	}
}

/**
 * todo: we need a real ModdedDex which can take all format names and output corresponding dexes
 * 1. change ModdedDex.modid from string to string[] - done
 * 2. add all old mods in ModModifier - maybe done
 * 3. probably delete BigModdedDex - done
 * 4. add new mods - WI long P
 */
const ModModifier: {
	[mod: string]: {
		movesMod?: (data: any, extra?: any) => any,
		itemsMod?: (data: any, extra?: any) => any,
		abilitiesMod?: (data: any, extra?: any) => any,
		speciesMod?: (data: any, extra?: any) => any,
		typesMod?: (data: any, extra?: any) => any,
		ModifySpecies?: (pokemon: Pokemon | ServerPokemon | Dex.PokemonSet, dex: ModdedDex, extra?: any) => Species,
		ModifyTierSet?: (tierSet: SearchRow[], dex: ModdedDex, extra?: any) => SearchRow[],
		ModifyLearnset?: (pokemon: Dex.PokemonSet, dex: ModdedDex, learnset: string[], extra?: any) => string[],
	},
} = {
	// regulars
	anythinggoes: {
		ModifyTierSet: (tierSet: SearchRow[], dex: ModdedDex, extra?: any): SearchRow[] => tierSet,
	},
	doubles: {
		speciesMod: (data: any, extra?: any): any => {
			let gen = 9;
			if (extra?.gen) gen = extra.gen;
			const table = window.BattleTeambuilderTable[`gen${gen}doubles`];
			if (data.id in table.overrideTier) data.tier = table.overrideTier[data.id];
		},
	},
	littlecup: {
		ModifyTierSet: (tierSet: SearchRow[], dex: ModdedDex, extra?: any): SearchRow[] => tierSet.slice(
			tierSet.findIndex(([type, value]) => type === 'header' && value === 'LC')
		),
	},
	nfe: {
		ModifyTierSet: (tierSet: SearchRow[], dex: ModdedDex, extra?: any): SearchRow[] => tierSet.slice(
			tierSet.findIndex(([type, value]) => type === 'header' && value === 'NFEs not in a higher tier')
		),
	},
	ou: {
		ModifyTierSet: (tierSet: SearchRow[], dex: ModdedDex, extra?: any): SearchRow[] => tierSet.slice(
			tierSet.findIndex(([type, value]) => type === 'header' && value === 'OU')
		),
	},
	// oms
	'350cup': {
		speciesMod: (data: any): any => {
			if (!data.exists) return;
			if (data.bst > 350) return;
			data.bst = 0;
			let newStats = { ...data.baseStats };
			for (const stat in data.baseStats) {
				newStats[stat] = data.baseStats[stat] * 2;
				if (newStats[stat] < 1) newStats[stat] = 1;
				if (newStats[stat] > 255) newStats[stat] = 255;
				data.bst += newStats[stat];
			}
			data.baseStats = newStats;
		},
		ModifyTierSet: (tierSet: SearchRow[], dex: ModdedDex, extra?: any): SearchRow[] => tierSet,
	},
	'500cup': {
		ModifyTierSet: (tierSet: SearchRow[], dex: ModdedDex, extra?: any): SearchRow[] => tierSet.filter(
			([type, id]) => {
				if (type === 'pokemon') {
					const bst = dex.species.get(id).bst;
					if (bst > 500) return false;
				}
				return true;
			}
		),
	},
	'600cup': {
		ModifyTierSet: (tierSet: SearchRow[], dex: ModdedDex, extra?: any): SearchRow[] => tierSet.filter(
			([type, id]) => {
				if (type === 'pokemon') {
					const bst = dex.species.get(id).bst;
					if (bst > 600) return false;
				}
				return true;
			}
		),
	},
	categoryswap: {
		movesMod: (data: any): any => {
			if (!data.exists) return;
			const categoryMap = {
				'Physical': 'Special',
				'Special': 'Physical',
				'Status': 'Status',
			};
			data.category = categoryMap[(data as Move).category];
		},
	},
	hackmons: {
		ModifyTierSet: (tierSet: SearchRow[], dex: ModdedDex, extra?: any): SearchRow[] => tierSet,
		ModifyLearnset: (pokemon: Dex.PokemonSet, dex: ModdedDex, learnset: string[]): string[] => {
			const moveDex = dex.getMovedex();
			const isNatDex = dex.modid.includes('natdex' as ID);
			const isLGPE = dex.modid.includes('gen7letsgo' as ID);
			const moves: string[] = [];
			for (const id in moveDex) {
				const move = dex.moves.get(id);
				// moves from future gens also filtered by the following line
				if (move.isNonstandard && !['Unobtainable', 'LGPE'].includes(move.isNonstandard)) continue;
				if (move.isNonstandard === 'LGPE' && !isLGPE) continue;
				if (move.isMax && dex.gen > 8 && !isNatDex) continue;
				if (typeof move.isMax === 'string') continue;
				if (move.isZ && dex.gen > 7 && !isNatDex) continue;
				moves.push(id);
			}
			return moves;
		},
	},
	metronome: {
		speciesMod: (data: any): any => {
			if (data.num >= 0) data.tier = String(data.num);
		},
		ModifyTierSet: (tierSet: SearchRow[], dex: ModdedDex, extra?: any): SearchRow[] => tierSet,
	},
	regicup: {
		speciesMod: (data: any): any => {
			if (!data.exists) return;
			data.bst = 0;
			let bestStatName = 'hp';
			let bestStat = 0;
			let newStats = { ...data.baseStats };
			for (const stat in data.baseStats) {
				const oldStat = data.baseStats[stat];
				if (oldStat > bestStat) {
					bestStatName = stat;
					bestStat = oldStat;
				}
				if (oldStat < 75) newStats[stat] = 50;
				else if (oldStat < 150) newStats[stat] = 100;
				else newStats[stat] = 200;
				data.bst += newStats[stat];
			}
			data.bst -= newStats[bestStatName] - 200;
			newStats[bestStatName] = 200;
			data.baseStats = newStats;
		},
		ModifyTierSet: (tierSet: SearchRow[], dex: ModdedDex, extra?: any): SearchRow[] => tierSet,
	},
	scalemons: {
		speciesMod: (data: any, extra?: any): any => {
			if (!data.exists) return;
			const cupName = (extra && (extra.modid as ID[]).find(id => id.includes('cup'))) || '600cup';
			const goalBST = parseInt(cupName.slice(0, 3));
			const bstWithoutHp: number = data.bst - data.baseStats['hp'];
			const scale = goalBST - data.baseStats['hp'];
			data.bst = data.baseStats['hp'];
			let newStats = { ...data.baseStats };
			for (const stat in data.baseStats) {
				if (stat === 'hp') continue;
				newStats[stat] = Math.floor(data.baseStats[stat] * scale / bstWithoutHp);
				if (newStats[stat] < 1) newStats[stat] = 1;
				if (newStats[stat] > 255) newStats[stat] = 255;
				data.bst += newStats[stat];
			}
			data.baseStats = newStats;
		},
		ModifyTierSet: (tierSet: SearchRow[], dex: ModdedDex, extra?: any): SearchRow[] => tierSet,
	},
	stabmons: {
		ModifyLearnset: (pokemon: Dex.PokemonSet, dex: ModdedDex, learnset: string[]): string[] => {
			const moveDex = dex.getMovedex();
			// const isNatDex = dex.modid.includes('natdex' as ID);
			// const isLGPE = dex.modid.includes('gen7letsgo' as ID);
			for (const id in moveDex) {
				if (learnset.includes(id)) continue;
				const move = dex.moves.get(id);
				if (move.isNonstandard && move.isNonstandard !== 'Unobtainable') continue;
				if (move.isZ || move.isMax) continue;

				let species = dex.species.get(pokemon.species);
				const speciesTypes: string[] = [];
				const moveTypes: string[] = [];
				for (let i = dex.gen; i >= species.gen && i >= move.gen; i--) {
					const genDex = Dex.forGen(i);
					moveTypes.push(genDex.moves.get(move.name).type);

					const _pokemon = genDex.species.get(species.name);
					let baseSpecies = genDex.species.get(_pokemon.changesFrom || _pokemon.name);
					if (!_pokemon.battleOnly) speciesTypes.push(..._pokemon.types);
					let prevo = _pokemon.prevo;
					while (prevo) {
						const prevoSpecies = genDex.species.get(prevo);
						speciesTypes.push(...prevoSpecies.types);
						prevo = prevoSpecies.prevo;
					}
					if (_pokemon.battleOnly && typeof _pokemon.battleOnly === 'string') {
						species = dex.species.get(_pokemon.battleOnly);
					}
					const excludedForme = (s: Species) => [
						'Alola', 'Alola-Totem', 'Galar', 'Galar-Zen', 'Hisui', 'Paldea', 'Paldea-Combat', 'Paldea-Blaze', 'Paldea-Aqua',
					].includes(s.forme);
					if (baseSpecies.otherFormes && !['Wormadam', 'Urshifu'].includes(baseSpecies.baseSpecies)) {
						if (!excludedForme(species)) speciesTypes.push(...baseSpecies.types);
						for (const formeName of baseSpecies.otherFormes) {
							const forme = dex.species.get(formeName);
							if (!forme.battleOnly && !excludedForme(forme)) speciesTypes.push(...forme.types);
						}
					}
				}
				let valid = false;
				for (let type of moveTypes) {
					if (speciesTypes.includes(type)) {
						valid = true;
						break;
					}
				}
				if (valid) learnset.push(id);
			}
			return learnset;
		},
	},
	thecardgame: {
		movesMod: (data: any): any => {
			if (!data.exists) return;
			data.type = data.type
				.replace(/(Ghost|Fairy)/g, 'Psychic')
				.replace(/Bug/g, 'Grass')
				.replace(/Ice/g, 'Water')
				.replace(/(Rock|Ground)/g, 'Fighting')
				.replace(/Flying/g, 'Normal')
				.replace(/Poison/g, 'Dark');
		},
		speciesMod: (data: any): any => {
			if (!data.exists) return;
			// eslint-disable-next-line no-restricted-globals
			data.types = Array.from(new Set(data.types.map((type: Dex.TypeName) => (
				type.replace(/(Ghost|Fairy)/g, 'Psychic')
					.replace(/Bug/g, 'Grass')
					.replace(/Ice/g, 'Water')
					.replace(/(Rock|Ground)/g, 'Fighting')
					.replace(/Flying/g, 'Normal')
					.replace(/Poison/g, 'Dark')
			))));
		},
	},
	// species oms
	createmons: {
		ModifySpecies: (pokemon: Pokemon | ServerPokemon | Dex.PokemonSet, dex: ModdedDex, extra?: any): Species => {
			const species = dex.species.get(
				(pokemon as Pokemon | ServerPokemon).speciesForme || (pokemon as Dex.PokemonSet).species);
			// in Teambuilder
			let evs = (pokemon as Dex.PokemonSet).evs;
			let types = [(pokemon as Dex.PokemonSet).hpType, (pokemon as Dex.PokemonSet).teraType];
			// in Battle
			if (!evs) {
				const details = (pokemon as Pokemon | ServerPokemon).details;
				const crtmInfo = (details.split(', ').find(value => value.startsWith('createmons:')) || '').slice(11);
				if (crtmInfo) {
					evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
					const evsArray = crtmInfo.split(',').slice(0, 6).map(Number);
					let i: Dex.StatName;
					for (i in evs) evs[i] = evsArray.shift() || 0;
					types = crtmInfo.split(',').slice(6);
				}
			}
			// no extra info
			if (!evs) return species;
			// eslint-disable-next-line no-restricted-globals
			types = Array.from(new Set(types));
			return new Species(species.id, species.name, { ...species, baseStats: evs, types });
		},
		ModifyTierSet: (tierSet: SearchRow[], dex: ModdedDex, extra?: any): SearchRow[] => {
			// for bc-specific pokemon
			const addedTierSet: SearchRow[] = [['header', 'BC-Specific']];
			const table = window.BattleTeambuilderTable['createmons'];
			for (const pokemon in table.overrideSpeciesData) {
				addedTierSet.push(['pokemon', pokemon as ID]);
			}
			return tierSet.concat(addedTierSet);
		},
		ModifyLearnset: (pokemon: Dex.PokemonSet, dex: ModdedDex, learnset: string[]): string[] => {
			const moveDex = dex.getMovedex();
			const moves: string[] = [];
			for (const id in moveDex) {
				const move = dex.moves.get(id);
				if (move.isNonstandard === 'CAP') continue;
				if (move.isMax || move.isZ) continue;
				moves.push(id);
			}
			return moves;
		},
		// for desc of tweaked signature moves
		movesMod: (data: any): any => {
			const table = window.BattleTeambuilderTable['createmons'];
			if (data.id in table.overrideMoveData) Object.assign(data, table.overrideMoveData[data.id]);
		},
		// for bc-specific pokemon
		speciesMod: (data: any): any => {
			const table = window.BattleTeambuilderTable['createmons'];
			if (data.id in table.overrideSpeciesData) {
				Object.assign(data, table.overrideSpeciesData[data.id]);
				data.exists = true;
			}
		},
	},
	crossevolution: {
		ModifySpecies: (pokemon: Pokemon | ServerPokemon | Dex.PokemonSet, dex: ModdedDex, extra?: any): Species => {
			const nameString = pokemon.name || '';
			// note that you can't know ur opponent pokemon's nickname before it is sent in
			const speciesString = (pokemon as Dex.PokemonSet).species || (pokemon as (Pokemon | ServerPokemon)).speciesForme;
			const species = dex.species.get(speciesString);
			if (nameString !== speciesString) {
				const crossSpecies = dex.species.get(nameString);
				if (!!crossSpecies.exists && crossSpecies.prevo) {
					const crossPrevoSpecies = dex.species.get(crossSpecies.prevo);
					if (!crossPrevoSpecies.prevo === !species.prevo) {
						const mixedSpecies = { ...species };
						mixedSpecies.bst = 0;
						let stat: Dex.StatName;
						let newStats = { ...mixedSpecies.baseStats };
						for (stat in mixedSpecies.baseStats) {
							newStats[stat] += crossSpecies.baseStats[stat] - crossPrevoSpecies.baseStats[stat];
							if (newStats[stat] < 1) newStats[stat] = 1;
							if (newStats[stat] > 255) newStats[stat] = 255;
							mixedSpecies.bst += newStats[stat];
						}
						mixedSpecies.baseStats = newStats;
						let newTypes = [...mixedSpecies.types];
						if (crossSpecies.types[0] !== crossPrevoSpecies.types[0]) newTypes[0] = crossSpecies.types[0];
						if (crossSpecies.types[1] !== crossPrevoSpecies.types[1]) newTypes[1] = crossSpecies.types[1] || crossSpecies.types[0];
						if (newTypes[0] === newTypes[1]) newTypes = [newTypes[0]];
						mixedSpecies.types = newTypes;
						mixedSpecies.abilities = crossSpecies.abilities;
						return new Species(mixedSpecies.id, mixedSpecies.name, { ...mixedSpecies });
					}
				}
			}
			return species;
		},
		ModifyLearnset: (pokemon: Dex.PokemonSet, dex: ModdedDex, learnset: string[]): string[] => {
			const name = pokemon.name || '';
			const crossSpecies = dex.species.get(name);
			if (!crossSpecies.exists) return learnset;
			const moveDex = dex.getMovedex();
			for (const id in moveDex) {
				if (learnset.includes(id)) continue;
				if (dex.canLearn(crossSpecies.id, id as ID)) learnset.push(id);
			}
			return learnset;
		},
	},
	infinitefusion: {
		ModifySpecies: (pokemon: Pokemon | ServerPokemon | Dex.PokemonSet, dex: ModdedDex, extra?: any): Species => {
			let name = '';
			// tips: ServerPokemon is what you know about your opponent's pokemon
			if ((pokemon as Pokemon | ServerPokemon).details) {
				const details = (pokemon as Pokemon | ServerPokemon).details;
				name = (details.split(', ').find(value => value.startsWith('headname:')) || '').slice(9);
			}
			if (name === '') { // teambuilder & mySidePokemon when TeamPreview
				name = pokemon.name || '';
			}
			const species = (pokemon as Dex.PokemonSet).species || (pokemon as (Pokemon | ServerPokemon)).speciesForme;
			const headSpecies = dex.species.get(name);
			const bodySpecies = dex.species.get(species);
			if (!headSpecies.exists || !bodySpecies.exists)
				return new Species(bodySpecies.id, bodySpecies.name, { ...bodySpecies });
			// what does these even do...
			// if (headSpecies.baseSpecies !== headSpecies.name || bodySpecies.baseSpecies !== bodySpecies.name) return new Species(bodySpecies.id, bodySpecies.name, {...bodySpecies});
			// const nonstandard = ['CAP', 'Custom'];
			// if (headSpecies.isNonstandard && nonstandard.includes(headSpecies.isNonstandard) ||
			// 	bodySpecies.isNonstandard && nonstandard.includes(bodySpecies.isNonstandard)
			// ) return new Species(bodySpecies.id, bodySpecies.name, {...bodySpecies});
			if (headSpecies.name === bodySpecies.name) {
				const specialSelfFusions: { [k: string]: string } = {
					deoxys: 'Deoxys-Attack',
					rotom: 'Rotom-Heat',
					shaymin: 'Shaymin-Sky',
					keldeo: 'Keldeo-Resolute',
					meloetta: 'Meloetta-Pirouette',
					greninja: 'Greninja-Ash',
					floette: 'Floette-Eternal',
					zygarde: 'Zygarde-Complete',
					hoopa: 'Hoopa-Unbound',
					lycanroc: 'Lycanroc-Dusk',
					wishiwashi: 'Wishiwashi-School',
					necrozma: 'Necrozma-Ultra',
					eternatus: 'Eternatus-Eternamax',
					palafin: 'Palafin-Hero',
					ogerpon: 'Ogerpon-Wellspring',
					terapagos: 'Terapagos-Stellar',
				};
				if (toID(headSpecies.name) in specialSelfFusions) {
					return dex.species.get(specialSelfFusions[toID(headSpecies.name)]);
				}
				if (headSpecies.otherFormes) {
					for (const forme of headSpecies.otherFormes) {
						if (forme.endsWith('-Mega') || forme.endsWith('-Mega-Y') ||
							forme.endsWith('-Primal') ||
							forme.endsWith('-Origin') ||
							forme.endsWith('-Therian') ||
							forme.endsWith('-Starter') ||
							forme.endsWith('-Crowned')
						) return dex.species.get(forme);
					}
				}
				return new Species(bodySpecies.id, bodySpecies.name, { ...bodySpecies });
			}
			const pair = [headSpecies.name, bodySpecies.name].sort();
			if (pair[0] === 'Kyurem' && pair[1] === 'Reshiram') return dex.species.get('Kyurem-White');
			if (pair[0] === 'Kyurem' && pair[1] === 'Zekrom') return dex.species.get('Kyurem-Black');
			if (pair[0] === 'Necrozma' && pair[1] === 'Solgaleo') return dex.species.get('Necrozma-Dusk-Mane');
			if (pair[0] === 'Lunala' && pair[1] === 'Necrozma') return dex.species.get('Necrozma-Dawn-Wings');
			if (pair[0] === 'Calyrex' && pair[1] === 'Glastrier') return dex.species.get('Calyrex-Ice');
			if (pair[0] === 'Calyrex' && pair[1] === 'Spectrier') return dex.species.get('Calyrex-Shadow');
			if (pair[0] === 'Arrokuda' && pair[1] === 'Cramorant') return dex.species.get('Cramorant-Gulping');
			if (pair[0] === 'Cramorant' && pair[1] === 'Pikachu') return dex.species.get('Cramorant-Gorging');

			const fusionSpecies = { ...bodySpecies };
			fusionSpecies.weightkg = Math.max(0.1, (headSpecies.weightkg + bodySpecies.weightkg) / 2);
			// fusionSpecies.evos
			let abilities: { 0: string, 1?: string, H?: string, S?: string } = {
				0: headSpecies.abilities[0],
				1: bodySpecies.abilities[1] || bodySpecies.abilities[0],
				H: headSpecies.abilities['H'],
				S: headSpecies.abilities['S'],
			};
			if (abilities['H'] === abilities[1] || abilities['H'] === abilities[0]) delete abilities['H'];
			if (abilities[1] === abilities[0]) delete abilities[1];
			fusionSpecies.abilities = abilities;
			fusionSpecies.bst = 0;
			let i: Dex.StatName;
			let newStats = { ...fusionSpecies.baseStats };
			for (i in fusionSpecies.baseStats) {
				let headStat, bodyStat;
				if (['hp', 'spa', 'spd'].includes(i)) {
					headStat = headSpecies.baseStats[i] * 2;
					bodyStat = bodySpecies.baseStats[i];
				} else {
					headStat = headSpecies.baseStats[i];
					bodyStat = bodySpecies.baseStats[i] * 2;
				}
				let stat = Math.floor((headStat + bodyStat) / 3);
				if (stat < 1) stat = 1;
				if (stat > 255) stat = 255;
				if (i === 'hp' && (pokemon as Dex.PokemonSet).ability === 'Wonder Guard') stat = 1;
				newStats[i] = stat;
				fusionSpecies.bst += stat;
			}
			fusionSpecies.baseStats = newStats;
			let newTypes = [headSpecies.types[0], bodySpecies.types[1] || bodySpecies.types[0]];
			if (newTypes[1] === newTypes[0]) newTypes = [newTypes[0]];
			fusionSpecies.types = newTypes;

			return new Species(fusionSpecies.id, fusionSpecies.name, { ...fusionSpecies });
		},
		ModifyTierSet: (tierSet: SearchRow[], dex: ModdedDex, extra?: any): SearchRow[] => tierSet.filter(
			([type, id]) => {
				if (type === 'pokemon') {
					const sp = dex.species.get(id);
					if (sp.baseSpecies !== sp.name) return false;
				}
				return true;
			}
		),
		ModifyLearnset: (pokemon: Dex.PokemonSet, dex: ModdedDex, learnset: string[]): string[] => {
			const name = pokemon.name || '';
			const headSpecies = dex.species.get(name);
			if (!headSpecies.exists) return learnset;
			const fusionSpecies = dex.species.getFromPokemon(pokemon);
			const moveDex = dex.getMovedex();
			for (const id in moveDex) {
				if (learnset.includes(id)) continue;
				if (!dex.canLearn(headSpecies.id, id as ID) && !dex.canLearn(fusionSpecies.id, id as ID)) continue;
				learnset.push(id);
			}
			return learnset;
		},
	},
	// teambuilder oms
	monotype: {
		ModifyTierSet: (tierSet: SearchRow[], dex: ModdedDex, extra?: any): SearchRow[] => tierSet.slice(
			tierSet.findIndex(([type, value]) => type === 'header' && value === 'OU')
		),
	},
	// pet mods
	natdex: {
		movesMod: (data: any): any => {
			if (data.isNonstandard === 'Past') data.isNonstandard = null;
		},
		speciesMod: (data: any, extra?: any): any => {
			let gen = 9;
			if (extra?.gen) gen = extra.gen;
			const table = window.BattleTeambuilderTable[`gen${gen}natdex`];
			if (data.id in table.overrideTier) data.tier = table.overrideTier[data.id];
		},
	},
	gen7letsgo: {
		movesMod: (data: any): any => {
			const table = window.BattleTeambuilderTable['gen7letsgo'];
			if (data.id in table.overrideMoveData) Object.assign(data, table.overrideMoveData[data.id]);
		},
		itemsMod: (data: any): any => {
			const table = window.BattleTeambuilderTable['gen7letsgo'];
			if (data.id in table.overrideItemData) Object.assign(data, table.overrideItemData[data.id]);
		},
		abilitiesMod: (data: any): any => {
			const table = window.BattleTeambuilderTable['gen7letsgo'];
			if (data.id in table.overrideAbilityData) Object.assign(data, table.overrideAbilityData[data.id]);
		},
		speciesMod: (data: any): any => {
			const table = window.BattleTeambuilderTable['gen7letsgo'];
			if (data.id in table.overrideSpeciesData) Object.assign(data, table.overrideSpeciesData[data.id]);
			data.abilities = { 0: "No Ability" };
			if (data.id in table.overrideTier) data.tier = table.overrideTier[data.id];
		},
	},
	gen8bdsp: {
		movesMod: (data: any): any => {
			const table = window.BattleTeambuilderTable['gen8bdsp'];
			if (data.id in table.overrideMoveData) Object.assign(data, table.overrideMoveData[data.id]);
		},
		itemsMod: (data: any): any => {
			const table = window.BattleTeambuilderTable['gen8bdsp'];
			if (data.id in table.overrideItemData) Object.assign(data, table.overrideItemData[data.id]);
		},
		abilitiesMod: (data: any): any => {
			const table = window.BattleTeambuilderTable['gen8bdsp'];
			if (data.id in table.overrideAbilityData) Object.assign(data, table.overrideAbilityData[data.id]);
		},
		speciesMod: (data: any): any => {
			const table = window.BattleTeambuilderTable['gen8bdsp'];
			if (data.id in table.overrideSpeciesData) Object.assign(data, table.overrideSpeciesData[data.id]);
			if (data.id in table.overrideTier) data.tier = table.overrideTier[data.id];
		},
	},
	gen9morebalancedhackmons: {
		movesMod: (data: any): any => {
			const table = window.BattleTeambuilderTable['gen9morebalancedhackmons'];
			if (data.id in table.overrideMoveData) Object.assign(data, table.overrideMoveData[data.id]);
		},
		itemsMod: (data: any): any => {
			const table = window.BattleTeambuilderTable['gen9morebalancedhackmons'];
			if (data.id in table.overrideItemData) Object.assign(data, table.overrideItemData[data.id]);
		},
		abilitiesMod: (data: any): any => {
			const table = window.BattleTeambuilderTable['gen9morebalancedhackmons'];
			if (data.id in table.overrideAbilityData) Object.assign(data, table.overrideAbilityData[data.id]);
		},
		speciesMod: (data: any): any => {
			const table = window.BattleTeambuilderTable['gen9morebalancedhackmons'];
			if (data.id in table.overrideSpeciesData) Object.assign(data, table.overrideSpeciesData[data.id]);
		},
		ModifyTierSet: (tierSet: SearchRow[], dex: ModdedDex, extra?: any): SearchRow[] => tierSet,
	},
	digimon: {
		movesMod: (data: any): any => {
			// if (data.exists === true) return;
			if (data.id in window.DigiMovedex) {
				Object.assign(data, window.DigiMovedex[data.id]);
				data.exists = true;
			}
		},
		itemsMod: (data: any): any => {
			// if (data.exists === true) return;
			if (data.id in window.DigiItems) {
				Object.assign(data, window.DigiItems[data.id]);
				data.exists = true;
			}
		},
		abilitiesMod: (data: any): any => {
			// if (data.exists === true) return;
			if (data.id in window.DigiAbilities) {
				Object.assign(data, window.DigiAbilities[data.id]);
				data.exists = true;
			}
		},
		speciesMod: (data: any): any => {
			// if (data.exists === true) return;
			if (data.id in window.Digidex) {
				Object.assign(data, window.Digidex[data.id]);
				data.exists = true;
			}
		},
		typesMod: (data: any): any => {
			// todo: don't let fairy type pass
			// hint: removeType
			let typeData = window.DigiTypeChart[data.id];
			if (typeData?.damageTaken) {
				typeData.exists = true;
				// what does the following 3 lines do?
				if (!typeData.id) typeData.id = data.id;
				if (!typeData.name) typeData.name = data.name;
				if (!typeData.effectType) typeData.effectType = 'Type';
				data = { ...typeData };
			}
		},
		ModifyLearnset: (pokemon: Dex.PokemonSet, dex: ModdedDex, learnset: string[]): string[] => {
			if (!pokemon.preEvo) return learnset;
			const preEvoSpecies = dex.species.get(pokemon.preEvo);
			const moveDex = dex.getMovedex();
			for (const id in moveDex) {
				if (learnset.includes(id)) continue;
				if (!dex.canLearn(preEvoSpecies.id, id as ID)) continue;
				learnset.push(id);
			}
			return learnset;
		},
	},
};

export const Teams = new class {
	unpack(buf: string) {
		if (!buf) return [];

		const team = [];
		let i = 0;
		let j = 0;

		while (true) {
			const set: Dex.PokemonSet = {} as any;
			team.push(set);

			// name
			j = buf.indexOf('|', i);
			set.name = buf.substring(i, j);
			i = j + 1;

			// species
			j = buf.indexOf('|', i);
			set.species = Dex.species.get(buf.substring(i, j)).name || set.name;
			i = j + 1;

			// item
			j = buf.indexOf('|', i);
			set.item = Dex.items.get(buf.substring(i, j)).name;
			i = j + 1;

			// ability
			j = buf.indexOf('|', i);
			const ability = Dex.abilities.get(buf.substring(i, j)).name;
			const species = Dex.species.get(set.species);
			set.ability = (species.abilities &&
				['', '0', '1', 'H', 'S'].includes(ability) ? species.abilities[ability as '0' || '0'] : ability);
			i = j + 1;

			// moves
			j = buf.indexOf('|', i);
			set.moves = buf.substring(i, j).split(',').map(
				moveid => Dex.moves.get(moveid).name
			);
			i = j + 1;

			// nature
			j = buf.indexOf('|', i);
			set.nature = buf.substring(i, j) as Dex.NatureName;
			if (set.nature as any === 'undefined') delete set.nature;
			i = j + 1;

			// evs
			j = buf.indexOf('|', i);
			if (j !== i) {
				const evstring = buf.substring(i, j);
				if (evstring.length > 5) {
					const evs = evstring.split(',');
					set.evs = {
						hp: Number(evs[0]) || 0,
						atk: Number(evs[1]) || 0,
						def: Number(evs[2]) || 0,
						spa: Number(evs[3]) || 0,
						spd: Number(evs[4]) || 0,
						spe: Number(evs[5]) || 0,
					};
				} else if (evstring === '0') {
					set.evs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
				}
			}
			i = j + 1;

			// gender
			j = buf.indexOf('|', i);
			if (i !== j) set.gender = buf.substring(i, j);
			i = j + 1;

			// ivs
			j = buf.indexOf('|', i);
			if (j !== i) {
				const ivs = buf.substring(i, j).split(',');
				set.ivs = {
					hp: ivs[0] === '' ? 31 : Number(ivs[0]),
					atk: ivs[1] === '' ? 31 : Number(ivs[1]),
					def: ivs[2] === '' ? 31 : Number(ivs[2]),
					spa: ivs[3] === '' ? 31 : Number(ivs[3]),
					spd: ivs[4] === '' ? 31 : Number(ivs[4]),
					spe: ivs[5] === '' ? 31 : Number(ivs[5]),
				};
			}
			i = j + 1;

			// shiny
			j = buf.indexOf('|', i);
			if (i !== j) set.shiny = true;
			i = j + 1;

			// level
			j = buf.indexOf('|', i);
			if (i !== j) set.level = parseInt(buf.substring(i, j), 10);
			i = j + 1;

			// happiness
			j = buf.indexOf(']', i);
			let misc;
			if (j < 0) {
				if (i < buf.length) misc = buf.substring(i).split(',', 7);
			} else {
				if (i !== j) misc = buf.substring(i, j).split(',', 7);
			}
			if (misc) {
				set.happiness = (misc[0] ? Number(misc[0]) : 255);
				set.hpType = misc[1];
				set.pokeball = misc[2];
				set.gigantamax = !!misc[3];
				set.dynamaxLevel = (misc[4] ? Number(misc[4]) : 10);
				set.teraType = misc[5];
				set.preEvo = misc[6];
			}
			if (j < 0) break;
			i = j + 1;
		}

		return team;
	}
	export(team: Dex.PokemonSet[] | string, gen: number, hidestats = false) {
		if (!team) return '';
		if (typeof team === 'string') {
			if (team.includes('\n')) return team;
			team = this.unpack(team);
		}
		let text = '';
		for (const curSet of team) {
			if (curSet.name && curSet.name !== curSet.species) {
				text += `${curSet.name} (${curSet.species})`;
			} else {
				text += `${curSet.species}`;
			}
			if (curSet.gender === 'M') text += ' (M)';
			if (curSet.gender === 'F') text += ' (F)';
			if (curSet.item) {
				text += ` @ ${curSet.item}`;
			}
			text += "  \n";
			if (curSet.ability) {
				text += `Ability: ${curSet.ability}  \n`;
			}
			if (curSet.level && curSet.level !== 100) {
				text += `Level: ${curSet.level}  \n`;
			}
			if (curSet.shiny) {
				text += 'Shiny: Yes  \n';
			}
			if (typeof curSet.happiness === 'number' && curSet.happiness !== 255 && !isNaN(curSet.happiness)) {
				text += `Happiness: ${curSet.happiness}  \n`;
			}
			if (curSet.pokeball) {
				text += `Pokeball: ${curSet.pokeball}  \n`;
			}
			if (curSet.hpType) {
				text += `Hidden Power: ${curSet.hpType}  \n`;
			}
			if (typeof curSet.dynamaxLevel === 'number' && curSet.dynamaxLevel !== 10 && !isNaN(curSet.dynamaxLevel)) {
				text += `Dynamax Level: ${curSet.dynamaxLevel}  \n`;
			}
			if (curSet.gigantamax) {
				text += 'Gigantamax: Yes  \n';
			}
			if (gen === 9) {
				const species = Dex.species.get(curSet.species);
				// no check forceTeraType for bc
				// text += `Tera Type: ${species.forceTeraType || curSet.teraType || species.types[0]}  \n`;
				text += `Tera Type: ${curSet.teraType || species.types[0]}  \n`;
			}
			if (curSet.preEvo) {
				text += 'Pre-Evolution: ' + curSet.preEvo + "  \n";
			}
			if (!hidestats) {
				let first = true;
				if (curSet.evs) {
					let j: Dex.StatName;
					for (j in BattleStatNames) {
						if (!curSet.evs[j]) continue;
						if (first) {
							text += 'EVs: ';
							first = false;
						} else {
							text += ' / ';
						}
						text += `${curSet.evs[j]!} ${BattleStatNames[j]}`;
					}
				}
				if (!first) {
					text += "  \n";
				}
				if (curSet.nature) {
					text += `${curSet.nature} Nature  \n`;
				}
				first = true;
				if (curSet.ivs) {
					let defaultIvs = true;
					let hpType = '';
					for (const move of curSet.moves) {
						if (move.substr(0, 13) === 'Hidden Power ' && move.substr(0, 14) !== 'Hidden Power [') {
							hpType = move.substr(13);
							if (!Dex.types.isName(hpType)) {
								alert(move + " is not a valid Hidden Power type.");
								continue;
							}
							let stat: Dex.StatName;
							for (stat in BattleStatNames) {
								if ((curSet.ivs[stat] === undefined ? 31 : curSet.ivs[stat]) !== (Dex.types.get(hpType).HPivs?.[stat] || 31)) {
									defaultIvs = false;
									break;
								}
							}
						}
					}
					if (defaultIvs && !hpType) {
						let stat: Dex.StatName;
						for (stat in BattleStatNames) {
							if (curSet.ivs[stat] !== 31 && curSet.ivs[stat] !== undefined) {
								defaultIvs = false;
								break;
							}
						}
					}
					if (!defaultIvs) {
						let stat: Dex.StatName;
						for (stat in BattleStatNames) {
							if (typeof curSet.ivs[stat] === 'undefined' || isNaN(curSet.ivs[stat]) || curSet.ivs[stat] === 31) continue;
							if (first) {
								text += 'IVs: ';
								first = false;
							} else {
								text += ' / ';
							}
							text += `${curSet.ivs[stat]} ${BattleStatNames[stat]}`;
						}
					}
				}
				if (!first) {
					text += "  \n";
				}
			}
			if (curSet.moves) {
				for (let move of curSet.moves) {
					if (move.startsWith('Hidden Power ')) {
						move = `${move.slice(0, 13)}[${move.slice(13)}]`;
					}
					if (move) {
						text += `- ${move}  \n`;
					}
				}
			}
			text += "\n";
		}
		return text;
	}
};

if (typeof require === 'function') {
	// in Node
	global.Dex = Dex;
	global.toID = toID;
}
