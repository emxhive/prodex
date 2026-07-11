export type RefDomain = 'file' | 'uri' | 'module' | 'symbol';
export type RefResolution = 'absolute' | 'relative' | 'search' | 'logical';
export type RefAnchor = 'source' | 'runtime';

export type ReferenceSemantics =
	| { domain: 'file';   resolution: 'absolute' }
	| { domain: 'file';   resolution: 'relative'; anchor: RefAnchor }
	| { domain: 'file';   resolution: 'search' }
	| { domain: 'uri';    resolution: 'absolute' }
	| { domain: 'uri';    resolution: 'relative'; anchor: RefAnchor }
	| { domain: 'module'; resolution: 'absolute' }
	| { domain: 'module'; resolution: 'relative'; anchor: RefAnchor }
	| { domain: 'module'; resolution: 'logical' }
	| { domain: 'symbol'; resolution: 'absolute' }
	| { domain: 'symbol'; resolution: 'logical' };
