import { registerDebugFunction } from './power-user.js';

const accessibilityMonitor = {
    observer: null,
    isMonitoring: false,
    violations: new Map(),

    toggle() {
        if (this.isMonitoring) {
            this.stop();
        } else {
            this.start();
        }
    },

    start() {
        if (this.isMonitoring) {
            toastr.warning('Accessibility monitoring is already active.');
            return;
        }

        this.violations.clear();
        this.isMonitoring = true;
        this.observer = new MutationObserver(this.handleDomChange.bind(this));

        const observerConfig = {
            childList: true,
            attributes: true,
            subtree: true,
        };

        this.observer.observe(document.body, observerConfig);

        toastr.success('Accessibility monitoring started!', 'Axe Monitor');
        console.log('[Axe Monitor] Monitoring started. Interact with the UI to detect issues.');
    },

    stop() {
        if (!this.isMonitoring) {
            toastr.warning('Accessibility monitoring is not active.');
            return;
        }

        this.observer.disconnect();
        this.isMonitoring = false;
        toastr.info('Accessibility monitoring stopped. Reporting results...', 'Axe Monitor');
        this.report();
    },

    handleDomChange: debounce(async function() {
        if (!this.isMonitoring) return;

        console.log('[Axe Monitor] DOM changed, running check...');

        if (!('axe' in globalThis)) {
            await import('../lib/axe.min.js');
        }

        globalThis.axe.run({
            runOnly: ['best-practice', 'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        }).then(results => {
            if (results.violations.length > 0) {
                console.log(`[Axe Monitor] Found ${results.violations.length} new potential issues.`);
                results.violations.forEach(violation => {
                    violation.nodes.forEach(node => {
                        const selector = node.target.join(' > ');
                        const uniqueKey = `${violation.id}-${selector}`;
                        if (!this.violations.has(uniqueKey)) {
                            this.violations.set(uniqueKey, {
                                ruleId: violation.id,
                                description: violation.description,
                                impact: violation.impact,
                                helpUrl: violation.helpUrl,
                                selector: selector,
                                html: node.html,
                            });
                        }
                    });
                });
            }
        });
    }, 500),

    report() {
        if (this.violations.size === 0) {
            toastr.success('No accessibility issues were detected during the session!', 'Axe Report');
            console.log('%c[Axe Report] 🎉 Hooray! No accessibility issues found.', 'color: green; font-weight: bold;');
            return;
        }

        const reportData = Array.from(this.violations.values());
        toastr.error(`Detected ${this.violations.size} unique accessibility issues. See console for details.`, 'Axe Report');

        const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
        reportData.sort((a, b) => impactOrder[a.impact] - impactOrder[b.impact]);

        console.groupCollapsed(`[Axe Report] 1. Detailed List of Violations (Sorted by Impact)`);
        reportData.forEach((issue) => {
            const element = document.querySelector(issue.selector);
            const impactColor = issue.impact === 'critical' || issue.impact === 'serious' ? 'red' : 'orange';
            console.groupCollapsed(`%c[${issue.impact.toUpperCase()}] %c${issue.ruleId}: ${issue.description}`, `color: ${impactColor}; font-weight: bold;`, 'color: inherit;');
            console.log('Description:', issue.description);
            console.log('Impact:', issue.impact);
            console.log('Selector:', issue.selector);
            console.log('Element:', element);
            console.log('HTML Snippet:', issue.html);
            console.log('Help:', issue.helpUrl);
            console.groupEnd();
        });
        console.groupEnd();

        console.groupCollapsed('[Axe Report] 2. Summary Statistics');
        const impactSummary = { critical: 0, serious: 0, moderate: 0, minor: 0 };
        const ruleSummary = {};
        reportData.forEach(issue => {
            if (impactSummary.hasOwnProperty(issue.impact)) {
                impactSummary[issue.impact]++;
            }
            ruleSummary[issue.ruleId] = (ruleSummary[issue.ruleId] || 0) + 1;
        });
        console.log('Issues by Impact Level:');
        console.table(impactSummary);
        console.log('Issues by Rule ID:');
        console.table(ruleSummary);
        console.groupEnd();

        console.groupCollapsed('[Axe Report] 3. Raw Data Array (for developers)');
        console.log(reportData);
        console.groupEnd();
    },
};

function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

export function initA11y() {
    registerDebugFunction(
        'axe-monitor-toggle',
        'Toggle Axe Accessibility Monitoring',
        'Starts/stops continuous monitoring of the UI. Click once to start, again to stop and report.',
        () => accessibilityMonitor.toggle(),
    );
}
