// open-next.config.ts - using memory cache to avoid R2 requirement
import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

export default defineCloudflareConfig({
	// Don't use R2 cache, use default memory cache
});
