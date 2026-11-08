import { test, expect } from '@playwright/test';
test('navigation and responsive foundation', async ({ page }) => {
 await page.goto('/');
 await expect(page.getByRole('heading', { level: 1 })).toContainText('Una buena pregunta');
 await page.getByRole('link', { name: 'Arquitectura', exact: true }).click();
 await expect(page.getByRole('heading', { level: 1 })).toContainText('Conectadas por contratos');
 expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('service readiness can recover from an outage', async ({ page }) => {
 let healthy = false;
 await page.route('**/api/v1/health/ready', route => healthy ? route.fulfill({ json: { status: 'ok', service: 'nexquiz-test-api' } }) : route.fulfill({ status: 503, json: { status: 'unavailable' } }));
 await page.goto('/system');
 await expect(page.getByText('Sin conexión', { exact: true })).toHaveCount(2);
 healthy = true;
 await page.getByRole('button', { name: 'Volver a comprobar' }).click();
 await expect(page.getByText('Disponible', { exact: true })).toHaveCount(2);
});
