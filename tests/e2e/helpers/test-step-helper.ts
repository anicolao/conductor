import { Page, TestInfo, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export interface Verification {
  spec: string;
  check: () => Promise<void>;
}

export interface StepOptions {
  description: string;
  verifications: Verification[];
}

interface DocStep {
  title: string;
  image: string;
  specs: string[];
}

export async function waitForAnimations(page: Page) {
  await page.evaluate(() => {
    return Promise.all(
      document.getAnimations().map(animation => animation.finished)
    );
  });
}

export class TestStepHelper {
  private stepCount = 0;
  private steps: DocStep[] = [];
  private metadataTitle = '';
  private metadataDescription = '';

  constructor(private page: Page, private testInfo: TestInfo) {}

  setMetadata(title: string, description: string) {
    this.metadataTitle = title;
    this.metadataDescription = description;
  }

  async step(id: string, options: StepOptions) {
    // 1. Run verifications
    for (const v of options.verifications) {
      await v.check();
    }

    const paddedIndex = String(this.stepCount++).padStart(3, '0');
    const filename = `${paddedIndex}-${id.replace(/_/g, '-')}.png`;

    // 2. Wait for animations and take screenshot
    await waitForAnimations(this.page);
    await expect(this.page).toHaveScreenshot(filename);

    // 3. Track for documentation
    this.steps.push({
      title: options.description,
      image: `./screenshots/${filename}`, // Path relative to README.md
      specs: options.verifications.map(v => v.spec)
    });
  }

  generateDocs() {
    const testDir = path.dirname(this.testInfo.file);
    const readmePath = path.join(testDir, 'README.md');

    let markdown = `# ${this.metadataTitle || this.testInfo.title}\n\n${this.metadataDescription}\n\n`;
    for (const step of this.steps) {
      markdown += `## ${step.title}\n\n![${step.title}](${step.image})\n\n### Verifications\n`;
      for (const spec of step.specs) {
        markdown += `- [x] ${spec}\n`;
      }
      markdown += `\n---\n\n`;
    }
    
    fs.writeFileSync(readmePath, markdown);
  }
}
