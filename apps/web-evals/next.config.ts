import type { NextConfig } from "next"

const nextConfig: NextConfig = {
	turbopack: {},
	transpilePackages: ["@roo-code/types"],
	webpack: (config, { isServer }) => {
		// Fix: Map .js imports to .ts files for @roo-code/types
		config.resolve.extensions = [".tsx", ".ts", ".js", ".jsx", ".mjs", ".mts"]

		// Add a resolver that maps .js to .ts for the types package
		config.resolve.alias = {
			...config.resolve.alias,
			"@roo-code/types": require("path").resolve(__dirname, "../../packages/types/src"),
		}

		return config
	},
}
