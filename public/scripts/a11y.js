import { registerDebugFunction } from './power-user.js';
import { debounce } from './utils.js';

const accessibilityMonitor = {
    observer: null,
    isMonitoring: false,
    violations: new Map(),
    lastRunInfo: null,
    scanQueue: new Set(),
    isScanning: false,

    toggle() {
        if (this.isMonitoring) {
            this.stop();
        } else {
            this.start();
        }
    },

    async start() {
        if (this.isMonitoring) {
            toastr.warning('Accessibility monitoring is already active.');
            return;
        }

        this.violations.clear();
        this.lastRunInfo = null;
        this.scanQueue.clear();
        this.isScanning = false;
        this.isMonitoring = true;

        this.observer = new MutationObserver((mutationsList) =>
            this.queueScan(mutationsList),
        );

        const observerConfig = {
            childList: true,
            attributes: true,
            subtree: true,
        };

        this.observer.observe(document.body, observerConfig);

        toastr.success('Accessibility monitoring started!', 'Axe Monitor');
        console.log('[Axe Monitor] Monitoring for dynamic UI changes has started.');

        setTimeout(async () => {
            console.log('[Axe Monitor] Performing initial scan of existing content...');
            this.scanQueue.add(document);
            await this.runScanNow();
            console.log('[Axe Monitor] Initial scan complete.');
        }, 500);
    },

    stop() {
        if (!this.isMonitoring) {
            toastr.warning('Accessibility monitoring is not active.');
            return;
        }

        this.runScanNow();

        this.observer.disconnect();
        this.isMonitoring = false;
        toastr.info(
            'Accessibility monitoring stopped. Reporting results...',
            'Axe Monitor',
        );
        this.report();
    },

    queueScan(mutationsList) {
        if (!this.isMonitoring) return;

        for (const mutation of mutationsList) {
            if (mutation.target.nodeType === Node.ELEMENT_NODE) {
                let parent = mutation.target;
                while (parent.parentNode && this.scanQueue.has(parent.parentNode)) {
                    this.scanQueue.delete(parent.parentNode);
                    parent = parent.parentNode;
                }
                this.scanQueue.add(mutation.target);
            }
        }

        this.debouncedRunScan();
    },

    async runScanNow() {
        if (this.isScanning) {
            return;
        }

        if (!this.isMonitoring || this.scanQueue.size === 0) {
            this.scanQueue.clear();
            return;
        }

        this.isScanning = true;
        try {
            const elementsToScan = this.scanQueue.has(document) ? document : Array.from(this.scanQueue);
            this.scanQueue.clear();

            console.log(
                `[Axe Monitor] Running check on ${elementsToScan === document ? 'the entire document' : `${Array.isArray(elementsToScan) ? elementsToScan.length : 1} element(s)`}...`,
                elementsToScan,
            );

            if (!('axe' in globalThis)) {
                await import('../lib/axe.min.js');
            }

            const results = await globalThis.axe.run(elementsToScan, {
                preload: false,
                runOnly: [
                    'best-practice',
                    'wcag2a',
                    'wcag2aa',
                    'wcag21a',
                    'wcag21aa',
                ],
                resultTypes: ['violations'],
            });

            console.log('[Axe Monitor] Scan complete. Results summary:', {
                violations: results.violations.length,
                passes: results.passes.length,
                incomplete: results.incomplete.length,
                inapplicable: results.inapplicable.length,
            });

            this.lastRunInfo = {
                url: results.url,
                timestamp: results.timestamp,
                testEngine: results.testEngine,
                testEnvironment: results.testEnvironment,
            };

            if (results.violations.length > 0) {
                console.log(
                    `[Axe Monitor] Found ${results.violations.length} new potential issues.`,
                );
                results.violations.forEach((violation) => {
                    violation.nodes.forEach((node) => {
                        const selector = node.target.join(' > ');
                        const uniqueKey = `${violation.id}-${selector}`;
                        if (!this.violations.has(uniqueKey)) {
                            this.violations.set(uniqueKey, {
                                ...violation,
                                selector: selector,
                                nodeInfo: node,
                            });
                        }
                    });
                });
            }
        } catch (error) {
            console.error('[Axe Monitor] Error during axe.run:', error);
        } finally {
            this.isScanning = false;
        }
    },

    debouncedRunScan: debounce(function () {
        accessibilityMonitor.runScanNow();
    }, 1000),

    report() {
        if (this.violations.size === 0) {
            toastr.success(
                'No accessibility issues were detected during the session!',
                'Axe Report',
            );
            console.log(
                '%c[Axe Report] 🎉 Hooray! No accessibility issues found.',
                'color: green; font-weight: bold;',
            );
            return;
        }

        const reportData = Array.from(this.violations.values());
        toastr.error(
            `Detected ${this.violations.size} unique accessibility issues. See console for details.`,
            'Axe Report',
        );

        const severityOrder = ['critical', 'serious', 'moderate', 'minor'];
        reportData.sort(
            (a, b) =>
                severityOrder.indexOf(a.impact) -
                severityOrder.indexOf(b.impact),
        );

        if (this.lastRunInfo) {
            console.groupCollapsed('[Axe Report] Test Environment Information');
            console.log('URL:', this.lastRunInfo.url);
            console.log(
                'Timestamp:',
                new Date(this.lastRunInfo.timestamp).toLocaleString(),
            );
            console.log(
                'Test Engine:',
                `${this.lastRunInfo.testEngine.name} v${this.lastRunInfo.testEngine.version}`,
            );
            console.log(
                'Environment:',
                `${this.lastRunInfo.testEnvironment.userAgent}`,
            );
            console.groupEnd();
        }

        console.groupCollapsed('[Axe Report] 1. Detailed List of Violations');
        reportData.forEach((issue) => {
            const element = document.querySelector(issue.selector);
            const impactColor =
                issue.impact === 'critical' || issue.impact === 'serious'
                    ? 'red'
                    : 'orange';
            console.groupCollapsed(
                `%c[${issue.impact.toUpperCase()}] %c${issue.id}: ${issue.description}`,
                `color: ${impactColor}; font-weight: bold;`,
                'color: inherit;',
            );

            console.log('Impact:', issue.impact);
            if (issue.nodeInfo.failureSummary) {
                console.log(
                    '%cfailureSummary:',
                    'font-weight: bold;',
                    issue.nodeInfo.failureSummary,
                );
            }
            console.log('Help:', issue.help);
            console.log('Element:', element);
            console.log('Selector:', issue.selector);
            console.log('HTML Snippet:', issue.nodeInfo.html);

            const logChecks = (checkType, checks) => {
                if (checks && checks.length > 0) {
                    console.groupCollapsed(checkType);
                    checks.forEach((check) => {
                        console.log(`- ${check.message}`);
                        if (check.data) {
                            console.log('  └ Data:', check.data);
                        }
                        if (
                            check.relatedNodes &&
                            check.relatedNodes.length > 0
                        ) {
                            console.log(
                                '  └ Related Nodes:',
                                check.relatedNodes.map((n) => ({
                                    selector: n.target.join(' > '),
                                    html: n.html,
                                })),
                            );
                        }
                    });
                    console.groupEnd();
                }
            };

            logChecks('any', issue.nodeInfo.any);
            logChecks('all', issue.nodeInfo.all);
            logChecks('none', issue.nodeInfo.none);

            console.log('Help URL:', issue.helpUrl);
            console.log('Tags:', issue.tags);
            console.groupEnd();
        });
        console.groupEnd();

        console.groupCollapsed('[Axe Report] 2. Summary Statistics');
        const impactSummary = {
            critical: 0,
            serious: 0,
            moderate: 0,
            minor: 0,
        };
        const ruleSummary = {};
        reportData.forEach((issue) => {
            if (
                Object.prototype.hasOwnProperty.call(
                    impactSummary,
                    issue.impact,
                )
            ) {
                impactSummary[issue.impact]++;
            }
            ruleSummary[issue.id] = (ruleSummary[issue.id] || 0) + 1;
        });
        console.log('Issues by Impact Level:');
        console.table(impactSummary);
        console.log('Issues by Rule ID:');
        console.table(ruleSummary);
        console.groupEnd();

        console.groupCollapsed('[Axe Report] 3. Raw Data Array');
        console.log(...reportData);
        console.groupEnd();
    },
};

export function initA11y() {
    registerDebugFunction(
        'axe-monitor-toggle',
        'Toggle Axe Accessibility Monitoring',
        'Starts/stops continuous monitoring of the UI. Click once to start, again to stop and report.',
        () => accessibilityMonitor.toggle(),
    );
}
