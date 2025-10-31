import fs from 'fs';
import path from 'path';

export interface TestResult {
  suite: string;
  test: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
  duration: number;
  error?: string;
  screenshot?: string;
  har?: string;
  trace?: string;
}

export interface TestSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  suites: Record<string, {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    tests: TestResult[];
  }>;
}

export class TestReportGenerator {
  private results: TestResult[] = [];
  private startTime: number = Date.now();

  addResult(result: TestResult) {
    this.results.push(result);
  }

  generateSummary(): TestSummary {
    const suites: Record<string, any> = {};
    
    for (const result of this.results) {
      if (!suites[result.suite]) {
        suites[result.suite] = {
          total: 0,
          passed: 0,
          failed: 0,
          skipped: 0,
          tests: []
        };
      }
      
      suites[result.suite].total++;
      suites[result.suite][result.status.toLowerCase()]++;
      suites[result.suite].tests.push(result);
    }

    const total = this.results.length;
    const passed = this.results.filter(r => r.status === 'PASS').length;
    const failed = this.results.filter(r => r.status === 'FAIL').length;
    const skipped = this.results.filter(r => r.status === 'SKIP').length;
    const duration = Date.now() - this.startTime;

    return {
      total,
      passed,
      failed,
      skipped,
      duration,
      suites
    };
  }

  generateMarkdownReport(): string {
    const summary = this.generateSummary();
    const timestamp = new Date().toISOString();
    
    let report = `# LockerRoom QA Test Report\n\n`;
    report += `**Generated:** ${timestamp}\n`;
    report += `**Duration:** ${summary.duration}ms\n\n`;
    
    report += `## Summary\n\n`;
    report += `| Metric | Count | Percentage |\n`;
    report += `|--------|-------|------------|\n`;
    report += `| Total Tests | ${summary.total} | 100% |\n`;
    report += `| Passed | ${summary.passed} | ${((summary.passed / summary.total) * 100).toFixed(1)}% |\n`;
    report += `| Failed | ${summary.failed} | ${((summary.failed / summary.total) * 100).toFixed(1)}% |\n`;
    report += `| Skipped | ${summary.skipped} | ${((summary.skipped / summary.total) * 100).toFixed(1)}% |\n\n`;
    
    report += `## Test Results by Suite\n\n`;
    
    for (const [suiteName, suiteData] of Object.entries(summary.suites)) {
      report += `### ${suiteName}\n\n`;
      report += `**Status:** ${suiteData.failed === 0 ? '✅ PASS' : '❌ FAIL'}\n`;
      report += `**Tests:** ${suiteData.passed}/${suiteData.total} passed\n\n`;
      
      if (suiteData.failed > 0) {
        report += `#### Failed Tests\n\n`;
        for (const test of suiteData.tests.filter((t: TestResult) => t.status === 'FAIL')) {
          report += `- **${test.test}**\n`;
          if (test.error) {
            report += `  - Error: ${test.error}\n`;
          }
          if (test.screenshot) {
            report += `  - Screenshot: ${test.screenshot}\n`;
          }
          if (test.har) {
            report += `  - HAR: ${test.har}\n`;
          }
          if (test.trace) {
            report += `  - Trace: ${test.trace}\n`;
          }
          report += `\n`;
        }
      }
      
      report += `\n`;
    }
    
    return report;
  }

  generateHTMLReport(): string {
    const summary = this.generateSummary();
    const timestamp = new Date().toISOString();
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>LockerRoom QA Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin: 20px 0; }
        .metric { background: #f9f9f9; padding: 15px; border-radius: 5px; text-align: center; }
        .metric.passed { background: #d4edda; }
        .metric.failed { background: #f8d7da; }
        .metric.skipped { background: #fff3cd; }
        .suite { margin: 20px 0; border: 1px solid #ddd; border-radius: 5px; }
        .suite-header { background: #f8f9fa; padding: 15px; font-weight: bold; }
        .suite-content { padding: 15px; }
        .test { margin: 10px 0; padding: 10px; border-radius: 3px; }
        .test.pass { background: #d4edda; }
        .test.fail { background: #f8d7da; }
        .test.skip { background: #fff3cd; }
        .error { color: #721c24; font-family: monospace; }
        .artifact { margin: 5px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>LockerRoom QA Test Report</h1>
        <p><strong>Generated:</strong> ${timestamp}</p>
        <p><strong>Duration:</strong> ${summary.duration}ms</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <p>${summary.total}</p>
        </div>
        <div class="metric passed">
            <h3>Passed</h3>
            <p>${summary.passed} (${((summary.passed / summary.total) * 100).toFixed(1)}%)</p>
        </div>
        <div class="metric failed">
            <h3>Failed</h3>
            <p>${summary.failed} (${((summary.failed / summary.total) * 100).toFixed(1)}%)</p>
        </div>
        <div class="metric skipped">
            <h3>Skipped</h3>
            <p>${summary.skipped} (${((summary.skipped / summary.total) * 100).toFixed(1)}%)</p>
        </div>
    </div>
    
    ${Object.entries(summary.suites).map(([suiteName, suiteData]) => `
        <div class="suite">
            <div class="suite-header">
                ${suiteName} - ${suiteData.failed === 0 ? '✅ PASS' : '❌ FAIL'} (${suiteData.passed}/${suiteData.total} passed)
            </div>
            <div class="suite-content">
                ${suiteData.tests.map((test: TestResult) => `
                    <div class="test ${test.status.toLowerCase()}">
                        <strong>${test.test}</strong> (${test.duration}ms)
                        ${test.error ? `<div class="error">${test.error}</div>` : ''}
                        ${test.screenshot ? `<div class="artifact">Screenshot: <a href="${test.screenshot}">${test.screenshot}</a></div>` : ''}
                        ${test.har ? `<div class="artifact">HAR: <a href="${test.har}">${test.har}</a></div>` : ''}
                        ${test.trace ? `<div class="artifact">Trace: <a href="${test.trace}">${test.trace}</a></div>` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `).join('')}
</body>
</html>`;
  }

  async saveReports() {
    const reportsDir = path.join(process.cwd(), 'docs', 'test_reports');
    await fs.promises.mkdir(reportsDir, { recursive: true });
    
    const markdownReport = this.generateMarkdownReport();
    const htmlReport = this.generateHTMLReport();
    
    await fs.promises.writeFile(
      path.join(reportsDir, 'summary.md'),
      markdownReport
    );
    
    await fs.promises.writeFile(
      path.join(reportsDir, 'e2e-report.html'),
      htmlReport
    );
    
    console.log(`Reports saved to ${reportsDir}`);
  }
}

export const reportGenerator = new TestReportGenerator();
