import { expect, test, type Page } from '@playwright/test';
async function login(page: Page, name: string, email: string) {
  await page.goto('/');
  await page.evaluate(
    async ({ name, email }) => {
      const path = '/tests/browser-auth.ts';
      const helper = await import(/* @vite-ignore */ path);
      await helper.login(name, email);
    },
    { name, email },
  );
  await expect(page.getByRole('heading', { name: 'Conversas.' })).toBeVisible();
}
test('duas contas: descoberta, envio real, leitura, mobile, tema e logout', async ({
  browser,
  page,
}) => {
  const suffix = Date.now();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const other = await mobile.newPage();
  await login(page, 'Marina Costa', `marina-${suffix}@example.com`);
  await login(other, 'Pedro Almeida', `pedro-${suffix}@example.com`);
  await page.getByRole('button', { name: 'Nova conversa', exact: true }).click();
  await page.getByLabel('E-mail da pessoa').fill(`pedro-${suffix}@example.com`);
  await page.getByRole('button', { name: 'Iniciar conversa', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pedro Almeida' })).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Mensagem', exact: true })
    .fill('Oi Pedro! Que bom encontrar você por aqui.');
  await page.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(
    page.getByRole('log').getByText('Oi Pedro! Que bom encontrar você por aqui.', { exact: true }),
  ).toHaveCount(1);
  await expect(other.getByLabel('Mensagens não lidas')).toBeVisible();
  await other.bringToFront();
  await other.getByRole('button', { name: /Marina Costa/ }).click();
  await expect(
    other.getByRole('log').getByText('Oi Pedro! Que bom encontrar você por aqui.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Lida', { exact: true })).toBeVisible();
  await other
    .getByRole('textbox', { name: 'Mensagem', exact: true })
    .fill('Oi Marina! Esse espaço ficou muito bom.');
  await other.getByRole('button', { name: 'Enviar mensagem', exact: true }).click();
  await expect(
    page.getByRole('log').getByText('Oi Marina! Esse espaço ficou muito bom.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Buscar nesta conversa' }).click();
  await page.getByRole('textbox', { name: 'Buscar no histórico carregado' }).fill('muito bom');
  await expect(page.getByRole('status').filter({ hasText: '1 resultado' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar busca' }).click();
  await page.bringToFront();
  await expect(page.getByLabel('Mensagens não lidas')).toHaveCount(0);
  await page.screenshot({
    path: 'artifacts/desktop-chat.png',
    fullPage: true,
    animations: 'disabled',
  });
  await other.screenshot({
    path: 'artifacts/mobile-chat.png',
    fullPage: true,
    animations: 'disabled',
  });
  await other.getByRole('button', { name: 'Voltar às conversas' }).click();
  await expect(other.getByRole('heading', { name: 'Conversas.' })).toBeVisible();
  await page.getByRole('button', { name: 'Ativar tema escuro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({
    path: 'artifacts/desktop-dark.png',
    fullPage: true,
    animations: 'disabled',
  });
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: 'Conversas.' })).toBeVisible();
  await page.getByRole('button', { name: 'Meu perfil' }).click();
  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await expect(page.getByRole('button', { name: 'Continuar com Google' })).toBeVisible();
  await mobile.close();
});
