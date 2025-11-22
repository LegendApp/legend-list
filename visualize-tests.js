#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

console.log('🚀 Generating test visualization...\n');

// Run tests and capture output
let testOutput, coverageOutput;
try {
    console.log('📋 Running tests...');
    // Capture both stdout and stderr combined using shell redirection
    testOutput = execSync('bun test 2>&1', {
        encoding: 'utf8',
    });

    console.log('📊 Running coverage analysis...');
    // Capture both stdout and stderr combined for coverage output
    coverageOutput = execSync('bun test --coverage 2>&1', {
        encoding: 'utf8',
    });
} catch (error) {
    // If commands fail, try to get output from stderr
    testOutput = error.stdout || error.stderr || '';
    coverageOutput = testOutput; // Use same output for both if one fails
    console.log('ℹ️ Tests completed with output captured from error.');
}

// Parse test results
function parseTestResults(testOut, coverageOut) {
    const results = {
        totalTests: 0,
        passedTests: 0,
        failedTests: 0,
        runtime: '0s',
        testFiles: 0,
        coverage: {
            lines: 0,
            functions: 0,
        },
        categories: {
            core: 0,
            utils: 0,
        },
    };

    // Extract basic stats - Bun format: " 421 pass"
    const passMatch = testOut.match(/\s(\d+)\spass/);
    if (passMatch) {
        results.passedTests = parseInt(passMatch[1]);
    }

    const failMatch = testOut.match(/\s(\d+)\sfail/);
    if (failMatch) {
        results.failedTests = parseInt(failMatch[1]);
    }

    results.totalTests = results.passedTests + results.failedTests;

    // Extract runtime - Bun format: "[2.03s]"
    const runtimeMatch = testOut.match(/\[(\d+\.?\d*)s\]/);
    if (runtimeMatch) {
        results.runtime = `${runtimeMatch[1]}s`;
    }

    // Extract test files count - Bun format: "across 13 files"
    const filesMatch = testOut.match(/across\s+(\d+)\s+files/);
    if (filesMatch) {
        results.testFiles = parseInt(filesMatch[1]);
    }

    // Extract coverage from coverage output
    const coverageMatch = coverageOut.match(/All files\s+\|\s+[\d.]+\s+\|\s+([\d.]+)/);
    if (coverageMatch) {
        results.coverage.lines = parseFloat(coverageMatch[1]);
    }

    const funcCoverageMatch = coverageOut.match(/All files\s+\|\s+([\d.]+)/);
    if (funcCoverageMatch) {
        results.coverage.functions = parseFloat(funcCoverageMatch[1]);
    }

    // Count core vs utils test files
    const coreFiles = (testOut.match(/__tests__\/core\//g) || []).length;
    const utilsFiles = (testOut.match(/__tests__\/utils\//g) || []).length;

    // If no matches, try counting unique file mentions
    if (coreFiles === 0 && utilsFiles === 0) {
        const coreMatches = testOut.match(/core\//g);
        const utilsMatches = testOut.match(/utils\//g);
        results.categories.core = coreMatches ? coreMatches.length : 0;
        results.categories.utils = utilsMatches ? utilsMatches.length : 0;
    } else {
        results.categories.core = coreFiles;
        results.categories.utils = utilsFiles;
    }

    return results;
}

const results = parseTestResults(testOutput, coverageOutput);

console.log('✨ Test Results:');
console.log(`   Tests: ${results.passedTests} passed, ${results.failedTests} failed`);
console.log(`   Coverage: ${results.coverage.lines}% lines`);
console.log(`   Runtime: ${results.runtime}`);
console.log(`   Files: ${results.testFiles} test files\n`);

console.log('🔍 Debug raw test output (first 500 chars):');
console.log('TEST OUTPUT:', testOutput.substring(0, 500));
console.log('\n🔍 Debug raw coverage output (first 500 chars):');
console.log('COVERAGE OUTPUT:', coverageOutput.substring(0, 500));

console.log('\n🔍 Results object:');
console.log(JSON.stringify(results, null, 2));

// Generate HTML
const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
});

// Generate HTML with proper substitution
const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Legend List - Test Results</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            padding: 20px;
        }

        .card {
            background: white;
            border-radius: 24px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
            position: relative;
            overflow: hidden;
        }

        .card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 6px;
            background: linear-gradient(90deg, #00d4aa, #00b4d8, #0077b6);
        }

        .header {
            text-align: center;
            margin-bottom: 32px;
        }

        .title {
            font-size: 2.5rem;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }

        .subtitle {
            color: #666;
            font-size: 1.1rem;
            font-weight: 500;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
            margin-bottom: 32px;
        }

        .stat-item {
            background: #f8f9fa;
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }

        .stat-item::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 3px;
            background: var(--accent-color);
        }

        .stat-item.tests {
            --accent-color: ${results.failedTests > 0 ? '#ef4444' : '#10b981'};
        }

        .stat-item.coverage {
            --accent-color: #3b82f6;
        }

        .stat-item.performance {
            --accent-color: #f59e0b;
        }

        .stat-item.files {
            --accent-color: #8b5cf6;
        }

        .stat-value {
            font-size: 2.2rem;
            font-weight: 700;
            color: #1a1a1a;
            margin-bottom: 8px;
        }

        .stat-label {
            color: #666;
            font-size: 0.9rem;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .progress-section {
            margin-bottom: 32px;
        }

        .progress-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 16px;
        }

        .progress-bar {
            background: #e5e7eb;
            border-radius: 12px;
            height: 12px;
            overflow: hidden;
            position: relative;
        }

        .progress-fill {
            height: 100%;
            background: linear-gradient(90deg, ${
                results.coverage.lines > 80
                    ? '#10b981, #059669'
                    : results.coverage.lines > 60
                    ? '#f59e0b, #d97706'
                    : '#ef4444, #dc2626'
            });
            border-radius: 12px;
            width: ${results.coverage.lines}%;
            position: relative;
            overflow: hidden;
        }

        .progress-fill::after {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent);
            animation: shimmer 2s infinite;
        }

        @keyframes shimmer {
            0% { left: -100%; }
            100% { left: 100%; }
        }

        .test-categories {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
            gap: 16px;
            margin-bottom: 32px;
        }

        .category {
            background: #f8f9fa;
            border-radius: 12px;
            padding: 16px;
            text-align: center;
            border-left: 4px solid var(--category-color);
        }

        .category.core {
            --category-color: #ef4444;
        }

        .category.utils {
            --category-color: #3b82f6;
        }

        .category-name {
            font-size: 0.85rem;
            font-weight: 600;
            color: #666;
            margin-bottom: 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

        .category-count {
            font-size: 1.4rem;
            font-weight: 700;
            color: #1a1a1a;
        }

        .footer {
            text-align: center;
            padding-top: 24px;
            border-top: 1px solid #e5e7eb;
        }

        .timestamp {
            color: #666;
            font-size: 0.9rem;
        }

        .emoji {
            font-size: 1.2em;
            margin-right: 8px;
        }

        .badge {
            display: inline-flex;
            align-items: center;
            background: ${results.failedTests > 0 ? '#ef4444' : '#10b981'};
            color: white;
            padding: 8px 16px;
            border-radius: 20px;
            font-size: 0.85rem;
            font-weight: 600;
            margin-top: 16px;
        }

        @media (max-width: 480px) {
            .card {
                padding: 24px;
                margin: 10px;
            }

            .title {
                font-size: 2rem;
            }

            .stats-grid {
                grid-template-columns: 1fr;
            }

            .test-categories {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <div class="card">
        <div class="header">
            <h1 class="title">@legendapp/list</h1>
            <p class="subtitle">Test Suite Results</p>
        </div>

        <div class="stats-grid">
            <div class="stat-item tests">
                <div class="stat-value">${results.passedTests}</div>
                <div class="stat-label"><span class="emoji">${results.failedTests > 0 ? '❌' : '✅'}</span>Tests ${
    results.failedTests > 0 ? 'Failing' : 'Passing'
}</div>
            </div>
            <div class="stat-item coverage">
                <div class="stat-value">${results.coverage.lines}%</div>
                <div class="stat-label"><span class="emoji">📊</span>Line Coverage</div>
            </div>
            <div class="stat-item performance">
                <div class="stat-value">${results.runtime}</div>
                <div class="stat-label"><span class="emoji">⚡</span>Runtime</div>
            </div>
            <div class="stat-item files">
                <div class="stat-value">${results.testFiles}</div>
                <div class="stat-label"><span class="emoji">📁</span>Test Files</div>
            </div>
        </div>

        <div class="progress-section">
            <div class="progress-title">Code Coverage</div>
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
        </div>

        <div class="test-categories">
            <div class="category core">
                <div class="category-name">Core</div>
                <div class="category-count">${results.categories.core}</div>
            </div>
            <div class="category utils">
                <div class="category-name">Utils</div>
                <div class="category-count">${results.categories.utils}</div>
            </div>
        </div>

        <div class="footer">
            <div class="badge">
                <span class="emoji">${results.failedTests > 0 ? '⚠️' : '🚀'}</span>
                ${
                    results.failedTests > 0
                        ? `${results.failedTests} Test${results.failedTests > 1 ? 's' : ''} Failing!`
                        : 'All Tests Passing!'
                }
            </div>
            <div class="timestamp">
                Generated on ${currentDate}
            </div>
        </div>
    </div>

    <script>
        // Add some interactive elements
        document.addEventListener('DOMContentLoaded', function() {
            // Animate the progress bar on load
            const progressFill = document.querySelector('.progress-fill');
            progressFill.style.width = '0%';
            setTimeout(() => {
                progressFill.style.transition = 'width 2s ease-in-out';
                progressFill.style.width = '${results.coverage.lines}%';
            }, 500);

            // Add hover effects to stat items
            const statItems = document.querySelectorAll('.stat-item');
            statItems.forEach(item => {
                item.addEventListener('mouseenter', function() {
                    this.style.transform = 'translateY(-2px)';
                    this.style.boxShadow = '0 8px 25px rgba(0,0,0,0.1)';
                    this.style.transition = 'all 0.3s ease';
                });

                item.addEventListener('mouseleave', function() {
                    this.style.transform = 'translateY(0)';
                    this.style.boxShadow = 'none';
                });
            });
        });
    </script>
</body>
</html>`;

// Write the HTML file
const outputPath = path.join(__dirname, 'test-visualization.html');
fs.writeFileSync(outputPath, htmlContent);

console.log('🎉 Visualization generated successfully!');
console.log(`📁 Output: ${outputPath}`);
console.log('\n💡 To view:');
console.log('   open test-visualization.html');
console.log('\n📸 Perfect for screenshots to share on Twitter!');
