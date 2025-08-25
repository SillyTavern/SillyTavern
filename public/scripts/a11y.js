import { registerDebugFunction } from './power-user.js';

export function initA11y() {
    registerDebugFunction(
        'axe-core',
        'Run axe-core accessibility checks',
        'Performs accessibility checks using axe-core library. Prints the results to the console.',
        async () => {
            if (!('axe' in globalThis)) {
                await import('../lib/axe.min.js');
            }

            globalThis.axe.run()
                .then(results => {
                    toastr.info('Accessibility check completed. See console for results.');
                    console.log(results);
                })
                .catch(err => {
                    toastr.error('Error running accessibility check. See console for details.');
                    console.error('Something bad happened:', err.message);
                });
        },
    );
}
