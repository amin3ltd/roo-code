declare module "js-yaml" {
	export function load(str: string): any
	export function dump(obj: any): string
}
