import { expect, test } from '@playwright/test';
import { BALI, poser } from './tripora';

/**
 * Le coffre : le code de la boîte à clés, le wifi, le numéro de l'hôte.
 *
 * Ce qu'on cherchait dans la discussion, devant la porte, à 23 h. Le mode
 * local suffit à vérifier le parcours : ranger, retrouver, s'en servir,
 * corriger, retirer.
 */
test('ranger un code, un wifi et un contact, puis s’en servir', async ({ page }) => {
  await poser(page, [BALI], '/voyages/v1');
  await page.getByRole('link', { name: /Coffre/u }).first().click();
  await expect(page).toHaveURL(/\/voyages\/v1\/coffre$/u);

  // Vide, il dit à quoi il sert.
  await page.getByRole('button', { name: 'Ajouter une info' }).click();

  // Un code : il manque ce qu'il ouvre, et le formulaire le dit.
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('textbox', { name: 'Code', exact: true }).fill('4521B');
  await page.getByRole('button', { name: 'Ranger dans le coffre' }).click();
  await expect(page.getByRole('alert')).toHaveText('Dites ce que ce code ouvre.');
  await page.getByRole('textbox', { name: 'Ce qu’il ouvre' }).fill('Boîte à clés');
  await page.getByRole('textbox', { name: 'Précision (facultatif)' }).fill('À droite de la porte');
  await page.getByRole('button', { name: 'Ranger dans le coffre' }).click();
  await expect(page.getByRole('heading', { name: 'Boîte à clés' })).toBeVisible();
  await expect(page.getByText('4521B')).toBeVisible();

  // Le wifi, et son QR code qui connecte sans rien taper.
  await page.getByRole('button', { name: 'Ajouter une info' }).click();
  await page.getByRole('button', { name: 'Wifi', exact: true }).click();
  await page.getByRole('textbox', { name: 'Réseau', exact: true }).fill('Villa-Ubud');
  await page.getByRole('textbox', { name: /Mot de passe/u }).fill('selamat2030');
  await page.getByRole('button', { name: 'Ranger dans le coffre' }).click();
  await page.getByRole('button', { name: 'QR code' }).click();
  await expect(page.getByRole('img', { name: 'QR code du wifi Villa-Ubud' })).toBeVisible();

  // Un contact : un numéro international ouvre aussi WhatsApp.
  await page.getByRole('button', { name: 'Ajouter une info' }).click();
  await page.getByRole('button', { name: 'Contact', exact: true }).click();
  await page.getByRole('textbox', { name: 'Qui', exact: true }).fill('Wayan (l’hôte)');
  await page.getByRole('textbox', { name: 'Téléphone' }).fill('+62 812 3456 7890');
  await page.getByRole('button', { name: 'Ranger dans le coffre' }).click();
  await expect(page.getByRole('link', { name: 'Appeler' })).toHaveAttribute('href', 'tel:+6281234567890');
  await expect(page.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/6281234567890');

  // Rangés par genre : le code d'abord, puis le wifi, puis le contact.
  await expect(page.getByRole('heading', { level: 3 })).toHaveText(['Boîte à clés', 'Villa-Ubud', 'Wayan (l’hôte)']);

  // Le code a changé : on le corrige.
  await page.getByRole('button', { name: 'Modifier « Boîte à clés »' }).click();
  await page.getByRole('textbox', { name: 'Code', exact: true }).fill('4521C');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('4521C')).toBeVisible();

  // Il survit au rechargement, et se retrouve sur l'accueil du voyage.
  await page.reload();
  await expect(page.getByText('4521C')).toBeVisible();
  await page.screenshot({ path: 'test-results/coffre.png', fullPage: true });

  await page.getByRole('button', { name: 'Retirer « Villa-Ubud »' }).click();
  await expect(page.getByRole('heading', { name: 'Villa-Ubud' })).toHaveCount(0);

  await page.getByRole('link', { name: 'Retour au voyage' }).click();
  await expect(page.getByRole('link', { name: /Coffre.*1 code · 1 contact/u }).first()).toBeVisible();
});

/**
 * Les documents : les billets, en PDF, rangés dans le coffre. En mode local,
 * le fichier vit dans le navigateur (IndexedDB) : le parcours est le même.
 */
test('ranger un billet en PDF, l’ouvrir, le renommer, le retirer', async ({ page }) => {
  await poser(page, [BALI], '/voyages/v1/coffre');

  // Un format que le coffre ne garde pas : refusé tout de suite, avec la raison.
  await page.getByLabel('Choisir un document').setInputFiles({
    name: 'archive.zip',
    mimeType: 'application/zip',
    buffer: Buffer.from('PK'),
  });
  await expect(page.getByText(/Seuls les PDF et les photos/u)).toBeVisible();

  // Le billet : un nom lisible est proposé, qu'on garde pour soi.
  await page.getByLabel('Choisir un document').setInputFiles({
    name: 'e-ticket_GA-881.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4\n%billet de test\n'),
  });
  await expect(page.getByRole('textbox', { name: 'Nom du document' })).toHaveValue('E-ticket GA-881');
  await page.getByRole('checkbox', { name: /Visible par moi seulement/u }).check();
  await page.getByRole('button', { name: 'Ranger le document' }).click();
  await expect(page.getByText('PDF · 1 Ko · visible par vous seulement')).toBeVisible();

  // Il s'ouvre dans un nouvel onglet.
  const [onglet] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Ouvrir « E-ticket GA-881 »' }).click(),
  ]);
  await expect.poll(() => onglet.url()).toMatch(/^blob:/u);
  await onglet.close();

  // Partagé avec le groupe, puis renommé.
  await page.getByRole('button', { name: 'Partager « E-ticket GA-881 » avec le groupe' }).click();
  await expect(page.getByText('PDF · 1 Ko', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Renommer « E-ticket GA-881 »' }).click();
  await page.getByRole('textbox', { name: 'Nouveau nom' }).fill('Vol aller Garuda');
  await page.getByRole('button', { name: 'Enregistrer le nom' }).click();
  await expect(page.getByRole('button', { name: 'Ouvrir « Vol aller Garuda »' })).toBeVisible();

  // Il survit au rechargement, et compte sur l'accueil du voyage.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Ouvrir « Vol aller Garuda »' })).toBeVisible();
  await page.screenshot({ path: 'test-results/coffre-documents.png', fullPage: true });
  await page.getByRole('link', { name: 'Retour au voyage' }).click();
  await expect(page.getByRole('link', { name: /Coffre.*1 document/u }).first()).toBeVisible();
  await page.goBack();

  await page.getByRole('button', { name: 'Retirer « Vol aller Garuda »' }).click();
  await expect(page.getByRole('button', { name: 'Ouvrir « Vol aller Garuda »' })).toHaveCount(0);
});
