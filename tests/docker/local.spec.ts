import { expect, test, type Page } from '@playwright/test';

async function login(page: Page, email: string) {
  await page.goto('/');
  const popupReady = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Continuar com Google' }).click();
  const popup = await popupReady;
  await popup.waitForLoadState('load');
  await popup.getByText(email, { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Conversas.' })).toBeVisible();
}

test('Compose: login simulado, contas prontas, mensagem em tempo real e painel local', async ({
  browser,
  page,
}) => {
  await login(page, 'marina@entre.test');
  await expect(page.getByRole('button', { name: /Luiza Santos/ }).first()).toBeVisible();
  await page
    .getByRole('button', { name: /Pedro Almeida/ })
    .first()
    .click();
  await expect(
    page.getByRole('log').getByText('Oi, Pedro! Que bom encontrar você por aqui.'),
  ).toBeVisible();

  const context = await browser.newContext({ baseURL: 'http://localhost:5173' });
  const other = await context.newPage();
  try {
    await login(other, 'pedro@entre.test');
    await other
      .getByRole('button', { name: /Marina Costa/ })
      .first()
      .click();
    const text = `Teste Docker ${Date.now()}`;
    await page.getByRole('textbox', { name: 'Mensagem', exact: true }).fill(text);
    await page.getByRole('button', { name: 'Enviar mensagem' }).click();
    await expect(page.getByRole('textbox', { name: 'Mensagem', exact: true })).toHaveValue('');
    await expect(other.getByRole('log').getByText(text, { exact: true })).toHaveCount(1);
    await page.screenshot({ path: 'artifacts/docker-chat.png', animations: 'disabled' });
    await other.goto('http://localhost:4000/auth');
    await expect(other).toHaveURL(/\/auth$/);
  } finally {
    await context.close();
  }
});
