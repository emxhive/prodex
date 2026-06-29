import { DetectionResult, LanguageProfile } from "./types";

export interface LanguageDetector {
	detect(filePath: string, contentHint?: string): DetectionResult | null;
}

export class FileExtensionDetector implements LanguageDetector {
	private profilesByExtension = new Map<string, LanguageProfile>();

	registerProfile(profile: LanguageProfile): void {
		for (const ext of profile.extensions) {
			const normalizedExt = ext.toLowerCase().trim();
			this.profilesByExtension.set(normalizedExt, profile);
		}
	}

	detect(filePath: string, _contentHint?: string): DetectionResult | null {
		const lowerPath = filePath.toLowerCase();
		let longestMatch: string | null = null;
		let matchedProfile: LanguageProfile | null = null;

		for (const [ext, profile] of this.profilesByExtension.entries()) {
			if (lowerPath.endsWith(ext)) {
				if (!longestMatch || ext.length > longestMatch.length) {
					longestMatch = ext;
					matchedProfile = profile;
				}
			}
		}

		if (!matchedProfile) {
			return null;
		}

		return {
			languageId: matchedProfile.languageId,
			profile: matchedProfile,
			confidence: 'high',
			method: 'extension'
		};
	}
}
