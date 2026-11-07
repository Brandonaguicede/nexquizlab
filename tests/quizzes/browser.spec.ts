import { expect, test } from '@playwright/test';
import { image, register } from './helpers';
test('protected authoring redirects to login', async ({ page }) => {
 await page.goto('/quizzes'); await expect(page).toHaveURL(/\/login$/); await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
});
test('real authoring forms, images, persistence, ordering and deletion are responsive', async ({ page, request }, testInfo) => {
 const user = await register(request);
 await page.goto('/login'); await page.getByLabel('Correo electrónico').fill(user.email); await page.getByLabel('Contraseña', { exact: true }).fill(user.password);
 await page.getByRole('button', { name: 'Entrar', exact: true }).click(); await expect(page).toHaveURL(/\/$/);
 await expect(page.getByRole('heading', { level: 1 })).toContainText('Buen'); await expect(page.getByRole('link', { name: 'Crear un cuestionario' })).toBeVisible();
 await page.getByRole('link', { name: 'Mis cuestionarios', exact: true }).click(); await expect(page.getByText('Tu primera pregunta empieza aquí.')).toBeVisible();
 await page.getByRole('button', { name: 'Crear cuestionario', exact: true }).first().click();
 await page.getByLabel('Título', { exact: true }).fill('Ciencias de nuestro planeta'); await page.getByLabel('Descripción').fill('Una exploración de verdadero o falso.');
 await page.getByRole('button', { name: 'Crear cuestionario', exact: true }).last().click(); await expect(page).toHaveURL(/\/quizzes\/[a-f0-9-]+$/);
 await page.getByRole('button', { name: 'Agregar pregunta' }).click(); await page.getByLabel('Enunciado').fill('La Tierra gira alrededor del Sol.'); await page.getByLabel('Respuesta correcta').selectOption('true');
 await page.getByLabel('Imagen (opcional)').setInputFiles({ name:'planeta.png',mimeType:'image/png',buffer:await image() });
 await expect(page.getByAltText('Vista previa de la imagen seleccionada')).toBeVisible(); await page.getByRole('button', { name:'Guardar pregunta',exact:true }).click();
 await expect(page.getByRole('heading',{name:'La Tierra gira alrededor del Sol.'})).toBeVisible(); await expect(page.getByAltText('Imagen adjunta de la pregunta')).toBeVisible();
 await page.getByRole('button',{name:'Agregar pregunta'}).click(); await page.getByLabel('Enunciado').fill('El Sol es un planeta.'); await page.getByLabel('Respuesta correcta').selectOption('false'); await page.getByRole('button',{name:'Guardar pregunta',exact:true}).click();
 await expect(page.getByRole('heading',{name:'El Sol es un planeta.'})).toBeVisible(); await page.getByRole('button',{name:'Subir pregunta 2',exact:true}).click();
 await expect(page.locator('.question-directory > li').first()).toContainText('El Sol es un planeta.');
 await page.reload(); await expect(page.locator('.question-directory > li').first()).toContainText('El Sol es un planeta.'); await expect(page.getByAltText('Imagen adjunta de la pregunta')).toBeVisible();
 await page.getByRole('button',{name:'Editar datos',exact:true}).click(); await page.getByLabel('Título',{exact:true}).fill('Nuestro planeta, revisado'); await page.getByRole('button',{name:'Guardar cuestionario',exact:true}).click(); await expect(page.getByRole('heading',{level:1})).toHaveText('Nuestro planeta, revisado');
 await page.getByRole('button',{name:'Editar pregunta',exact:true}).first().click(); await page.getByLabel('Enunciado').fill('El Sol es una estrella.'); await page.getByLabel('Respuesta correcta').selectOption('true'); await page.getByRole('button',{name:'Guardar pregunta',exact:true}).click();
 await expect(page.getByRole('heading',{name:'El Sol es una estrella.'})).toBeVisible();
 await page.screenshot({path:testInfo.outputPath('editor.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 const withImage=page.locator('.question-directory > li').filter({has:page.getByRole('heading',{name:'La Tierra gira alrededor del Sol.'})});
 await withImage.getByRole('button',{name:'Editar pregunta',exact:true}).click(); await page.getByLabel('Reemplazar imagen').setInputFiles({name:'nueva.webp',mimeType:'image/webp',buffer:await image('webp')}); await page.getByRole('button',{name:'Guardar pregunta',exact:true}).click();
 await expect(page.getByAltText('Imagen adjunta de la pregunta')).toBeVisible();
 page.on('dialog',dialog=>dialog.accept()); await page.getByRole('button',{name:'Eliminar imagen',exact:true}).click(); await expect(page.getByAltText('Imagen adjunta de la pregunta')).toHaveCount(0);
 await page.getByRole('button',{name:'Eliminar pregunta',exact:true}).first().click(); await expect(page.locator('.question-directory > li')).toHaveCount(1);
 await page.getByRole('link',{name:'← Mis cuestionarios',exact:true}).click(); await expect(page.getByRole('heading',{name:'Nuestro planeta, revisado'})).toBeVisible(); await page.screenshot({path:testInfo.outputPath('library.png'),fullPage:true});
 await page.getByRole('button',{name:'Eliminar',exact:true}).click(); await expect(page.getByText('Tu primera pregunta empieza aquí.')).toBeVisible();
 // Network failure is injected only in this test; production always consumes the real API.
 await page.route('**/game/api/v1/quizzes?*',route=>route.fulfill({status:503,contentType:'application/json',body:'{}'}),{times:1}); await page.reload(); await expect(page.getByRole('button',{name:'Reintentar',exact:true})).toBeVisible(); await page.getByRole('button',{name:'Reintentar',exact:true}).click(); await expect(page.getByText('Tu primera pregunta empieza aquí.')).toBeVisible();
});
