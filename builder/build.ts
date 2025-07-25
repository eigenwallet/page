import { marked } from 'marked';
import fs from 'fs';
import path from 'path';
import { processDownloadTemplate } from './downloads.js';
import { processStatsTemplate } from './statistics.js';

interface FootnoteMatch {
  num: string;
  content: string;
}



// Configure marked to handle footnotes and math
marked.setOptions({
  breaks: false,
  gfm: true,
  pedantic: false,
  silent: false,
});

/**
 * Read and process markdown file
 */
function readMarkdownFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    console.error(`Error reading markdown file: ${error}`);
    process.exit(1);
  }
}

/**
 * Process internal links to other pages
 */
function processInternalLinks(content: string): string {
  // Convert markdown links to other .md files to .html
  content = content.replace(/href="([^"]+)\.md"/g, 'href="$1.html"');

  // Support [[page]] syntax for easy linking
  content = content.replace(/\[\[([^\]]+)\]\]/g, (match, pageName) => {
    const fileName = pageName.toLowerCase().replace(/\s+/g, '-');
    return `<a href="${fileName}.html">${pageName}</a>`;
  });

  return content;
}

/**
 * Convert markdown to HTML and post-process footnotes
 */
function convertMarkdownToHtml(markdown: string): string {
  const htmlContent = marked(markdown) as string;

  // Post-process to handle footnotes
  let processedHtml = htmlContent;

  // First, handle normal footnotes with ^[number] format
  processedHtml = processedHtml.replace(
    /\^\[(\d+)\]/g,
    '<sup><a href="#fn$1" id="ref$1">$1</a></sup>'
  );

  // Then, handle footnotes that were converted to links by marked
  processedHtml = processedHtml.replace(
    /\^<a href="[^"]*" title="[^"]*">(\d+)<\/a>/g,
    '<sup><a href="#fn$1" id="ref$1">$1</a></sup>'
  );

  // Process internal links
  return processInternalLinks(processedHtml);
}

/**
 * Process footnotes from the references section
 */
function processFootnotes(content: string): string {
  const referencesRegex = /<h2>References<\/h2>\s*([\s\S]*?)$/;
  const referencesMatch = content.match(referencesRegex);

  if (!referencesMatch) {
    return content;
  }

  const referencesText = referencesMatch[1];

  // More robust regex to extract footnote definitions
  const footnoteRegex =
    /<p>\[(\d+)\]:\s*([\s\S]*?)(?=<\/p>\s*<p>\[(?:\d+)\]:|<\/p>\s*$)/g;
  let footnotes = '<div class="footnotes">\n';

  let match: RegExpExecArray | null;
  while ((match = footnoteRegex.exec(referencesText)) !== null) {
    const footnoteNum = match[1];
    let footnoteContent = match[2];

    // Clean up the HTML and remove closing </p> tags
    footnoteContent = footnoteContent.replace(/<\/p>\s*$/, '').trim();

    footnotes += `  <p id="fn${footnoteNum}">\n    ${footnoteNum}. ${footnoteContent}\n    <a href="#ref${footnoteNum}" title="Jump back to footnote ${footnoteNum} in the text.">↩</a>\n  </p>\n`;
  }

  footnotes += '</div>';
  return content.replace(referencesRegex, footnotes);
}

/**
 * Extract abstract content and clean main content
 */
function extractAbstractAndMainContent(content: string): {
  abstract: string;
  main: string;
} {
  // Match abstract without URL
  const abstractMatch = content.match(
    /<h2>Abstract<\/h2>\s*<p><strong><em>eigenwallet<\/em><\/strong> (.*?)<\/p>\s*<p>(.*?)<\/p>/s
  );

  let abstractContent = '';
  let mainContent = content;

  if (abstractMatch) {
    const content1 = abstractMatch[1];
    const content2 = abstractMatch[2];

    abstractContent = `<p><strong><em>eigenwallet</em></strong> ${content1}<br>${content2}</p>`;

    // Remove the abstract section from the main content
    mainContent = content.replace(
      /<h1><strong>eigenwallet<\/strong><\/h1>\s*<h2>Abstract<\/h2>\s*<p>.*?<\/p>\s*<p>.*?<\/p>\s*<hr>/s,
      ''
    );
  } else {
    // For pages without abstract, remove any standalone h1 title at the beginning
    mainContent = content.replace(
      /^<h1><strong>eigenwallet<\/strong><\/h1>\s*/,
      ''
    );
  }

  return { abstract: abstractContent, main: mainContent };
}

/**
 * Generate social media links section
 */
function generateSocialLinks(): string {
  return `
  <div style="text-align: center; margin: 2rem 0;">
    <a href="https://discord.gg/aqSyyJ35UW" target="_blank" style="text-decoration: none; color: inherit; margin: 0 1rem;"><img src="imgs/discord.svg" alt="Discord" style="height: 1.5em; width: 1.5em; vertical-align: baseline; display: inline;"></a>
    <a href="https://x.com/eigenwallet" target="_blank" style="text-decoration: none; color: inherit; margin: 0 1rem;"><img src="imgs/x.svg" alt="Twitter/X" style="height: 1.5em; width: 1.5em; vertical-align: baseline; display: inline;"></a>
    <a href="https://matrix.to/#/%23unstoppableswap-space:matrix.org" target="_blank" style="text-decoration: none; color: inherit; margin: 0 1rem;"><img src="imgs/matrix.svg" alt="Matrix" style="height: 1.5em; width: 1.5em; vertical-align: baseline; display: inline;"></a>
    <a href="https://github.com/eigenwallet/core" target="_blank" style="text-decoration: none; color: inherit; margin: 0 1rem;"><img src="imgs/github.svg" alt="GitHub" style="height: 1.5em; width: 1.5em; vertical-align: baseline; display: inline;"></a>
    <a href="http://eigenwu5vl53rjyd3zxfzy25mfoaeqlhpuvlu5s46ygggllfbb4beiid.onion/" target="_blank" style="text-decoration: none; color: inherit; margin: 0 1rem;"><img src="imgs/tor.svg" alt="Tor" style="height: 1.5em; width: 1.5em; vertical-align: baseline; display: inline;"></a>
  </div>`;
}

/**
 * Generate navigation component
 */
function generateNavigation(currentFileName: string): string {
  const isVisionPage = currentFileName === 'index.html';
  const isDownloadPage = currentFileName === 'download.html';
  const isStatsPage = currentFileName === 'statistics.html';
  
  const visionStyle = isVisionPage ? 'text-decoration: underline;' : 'text-decoration: none;';
  const downloadStyle = isDownloadPage ? 'text-decoration: underline;' : 'text-decoration: none;';
  const statsStyle = isStatsPage ? 'text-decoration: underline;' : 'text-decoration: none;';
  
  return `
  <nav style="text-align: center; margin: 0.25rem 0 0.25rem 0; padding: 0.25rem 0;">
    <a href="index.html" style="${visionStyle} color: inherit; margin: 0 1rem; font-weight: 500;">Vision</a>
    <a href="download.html" style="${downloadStyle} color: inherit; margin: 0 1rem; font-weight: 500;">Download</a>
    <a href="statistics.html" style="${statsStyle} color: inherit; margin: 0 1rem; font-weight: 500;">Statistics</a>
  </nav>
  <hr style="margin: 0.5rem 0 2rem 0;" />`;
}

/**
 * Generate complete HTML document
 */
function generateHtmlDocument(
  abstractContent: string,
  mainContent: string,
  fileName: string
): string {
  const abstractSection = abstractContent
    ? `
  <div class="abstract">
    <h2>Abstract</h2>
    ${abstractContent}
  </div>`
    : '';

  const isIndexPage = fileName === 'index.html';
  const socialLinksSection = isIndexPage ? generateSocialLinks() : '';
  const backButton = !isIndexPage
    ? `<a href="index.html" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); text-decoration: none; font-size: 1.5em; color: inherit; padding: 0.5rem;">&lt;</a>`
    : '';

  const navigation = generateNavigation(fileName);

  return `<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="google-site-verification" content="tm5Y6ZNTf-lBqbwniGjQPv1q02o2TuUQZ9GTYa4SMLg" />
  <title>eigenwallet — The Monero wallet for the future</title>
  <link rel="stylesheet" href="latex.css" />
  <link rel="stylesheet" href="prism/prism.css" />
  <link rel="icon" type="image/png" href="imgs/icon.png" />
</head>

<body id="top" class="text-justify">
  <header style="text-align: center; display: flex; justify-content: center; align-items: center; gap: 0.5rem; position: relative; padding: 1rem 0;">
    ${backButton}
    <a href="index.html" style="text-decoration: none; color: inherit; display: flex; align-items: center; gap: 0.5rem;">
      <img src="imgs/icon.svg" alt="eigenwallet logo" style="height: 5em;" />
    </a>
  </header>
${abstractSection}
${socialLinksSection}

  <main>
    <article>
      <hr style="margin: 0.5rem 0;" />
      ${navigation}
      ${mainContent}
    </article>
  </main>

  <script>
    MathJax = {
      tex: {
        inlineMath: [['$', '$'],],
      },
    }
  </script>
  <script type="text/javascript" id="MathJax-script" async
  src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js">
  </script>
</body>

</html>`;
}

/**
 * Write HTML content to file
 */
function writeHtmlFile(
  content: string,
  outputPath: string,
  inputPath: string
): void {
  try {
    fs.writeFileSync(outputPath, content);
    console.log(`Successfully generated ${outputPath} from ${inputPath}`);
  } catch (error) {
    console.error(`Error writing HTML file: ${error}`);
    process.exit(1);
  }
}

/**
 * Check if download assets flag is enabled
 */
function shouldDownloadAssets(): boolean {
  return process.argv.includes('--download-assets');
}

/**
 * Build a single markdown file to HTML
 */
async function buildFile(inputPath: string, outputPath: string): Promise<void> {
  // Read markdown file
  let markdownContent = readMarkdownFile(inputPath);

  // Special handling for download page
  const fileName = path.basename(inputPath, '.md');
  if (fileName === 'download') {
    const downloadAssets = shouldDownloadAssets();
    markdownContent = await processDownloadTemplate(markdownContent, downloadAssets);
  }

  // Convert markdown to HTML
  let htmlContent = convertMarkdownToHtml(markdownContent);

  // Special handling for statistics page (after markdown conversion to avoid SVG escaping)
  if (fileName === 'statistics') {
    htmlContent = await processStatsTemplate(htmlContent);
  }

  // Process footnotes
  const processedContent = processFootnotes(htmlContent);

  // Extract abstract and main content
  const { abstract, main } = extractAbstractAndMainContent(processedContent);

  // Generate complete HTML document
  const outputFileName = path.basename(outputPath);
  const fullHTML = generateHtmlDocument(abstract, main, outputFileName);

  // Write to output file
  writeHtmlFile(fullHTML, outputPath, inputPath);
}

/**
 * Discover all markdown files in content directory
 */
function discoverMarkdownFiles(): string[] {
  try {
    const contentDir = 'content';
    const files = fs.readdirSync(contentDir);
    return files
      .filter(file => file.endsWith('.md'))
      .map(file => path.join(contentDir, file));
  } catch (error) {
    console.error(`Error reading content directory: ${error}`);
    return [];
  }
}

/**
 * Convert input path to output path
 */
function getOutputPath(inputPath: string): string {
  const fileName = path.basename(inputPath, '.md');
  const outputFileName =
    fileName === 'index' ? 'index.html' : `${fileName}.html`;
  return path.join('dist', outputFileName);
}

/**
 * Copy static assets to dist directory
 */
function copyStaticAssets(): void {
  const staticDirs = ['imgs', 'fonts', 'lang', 'prism'];
  const staticFiles = ['latex.css'];

  staticDirs.forEach(dir => {
    if (fs.existsSync(dir)) {
      const destDir = path.join('dist', dir);
      if (fs.existsSync(destDir)) {
        fs.rmSync(destDir, { recursive: true, force: true });
      }

      // Copy directory but skip if it's trying to copy into itself
      const srcPath = path.resolve(dir);
      const destPath = path.resolve(destDir);

      if (!destPath.startsWith(srcPath)) {
        fs.cpSync(dir, destDir, { recursive: true });
        console.log(`Copied ${dir}/ to dist/${dir}/`);
      }
    }
  });

  staticFiles.forEach(file => {
    if (fs.existsSync(file)) {
      const destFile = path.join('dist', file);
      fs.copyFileSync(file, destFile);
      console.log(`Copied ${file} to dist/${file}`);
    }
  });
}

/**
 * Main build process
 */
async function main(): Promise<void> {
  // Ensure dist directory exists
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist', { recursive: true });
  }

  // Copy static assets
  copyStaticAssets();

  // Discover all markdown files
  const markdownFiles = discoverMarkdownFiles();

  if (markdownFiles.length === 0) {
    console.log('No markdown files found in content directory');
    return;
  }

  // Build each markdown file
  const buildPromises = markdownFiles.map(async inputPath => {
    const outputPath = getOutputPath(inputPath);
    await buildFile(inputPath, outputPath);
  });

  await Promise.all(buildPromises);
  console.log(`\n🎉 Built ${markdownFiles.length} files successfully!`);
}

// Run the build process
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('Build failed:', error);
    process.exit(1);
  });
}

export { main as buildMarkdownToHtml };
