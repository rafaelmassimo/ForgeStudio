# Editing the website

The site has a simple editor at **https://www.forgestrengthstudio.com/admin/**. You can change text and photos, and show or hide sections. Every change you save goes live on its own in about a minute.

## Logging in

1. Open the invitation email and set a password.
2. Go to `/admin/` on the website and sign in with your email and that password.

If you forget your password, use "Forgot password?" on the sign-in screen.

## Changing text

1. Click **Pages** and pick the page, for example **Home**. **Every page** holds the footer, the phone number, email, address, opening hours, social links and the scrolling words.
2. Open a section, for example **Hero**, by clicking its name.
3. Edit the fields.
   - **Heading** boxes: press Enter where you want the line to break.
   - **Text** boxes with a toolbar: you can make words bold or italic and add links. Leave an empty line between paragraphs.
   - **(phones)** fields hold the version shown on phones. Some sections are worded differently on small screens, so update both.
4. Click **Publish** at the top, then **Publish now**.

Wait about a minute, then refresh the website to see the change.

## Changing a photo

1. Open the section and click **Choose different image** under the photo.
2. Upload the new photo, select it and click **Choose selected**.
3. Fill in **Photo description**: one short sentence saying what the photo shows, for visitors who use screen readers.
4. Publish.

Photo tips:

- Each photo field says the minimum size it needs. Use a photo of about the same shape as the current one, or it will be cropped.
- Keep files under **500 KB**. Large photos slow the site down, especially on phones. [squoosh.app](https://squoosh.app) can shrink a photo for free: choose "MozJPEG" and a quality of about 75.

## Showing or hiding a section

Most sections have a **Show this section** switch at the top. Turn it off and publish to hide the section, and turn it back on to bring it back. The content is kept while it's hidden.

The **Hotel guests** section (Services & Plans), the **Sauna** (Our Space) and the **Partners & hotel guests** questions (FAQ) start hidden.

## Community stories

**Pages → Community stories** lists the testimonials shown on the Home and Who We Are pages. Add, remove or drag them to change the order.

## If something goes wrong

Every save is recorded, so any change can be undone. Contact your web developer and tell them which page you changed and roughly when.

---

# For the developer

## How it works

- Editable spots in the six `.html` pages carry `data-cms*` attributes. The top of `scripts/cms-lib.mjs` documents each one.
- Content lives in `content/<page>.json`, plus `content/global.json` for shared content. Testimonials stay in `data/community-stories.json`, which `js/main.js` reads.
- `npm run build` copies the site to `dist/`, writes the JSON values into the pages and strips the attributes. If a value still matches the HTML, that spot is left byte-for-byte as it is. Vercel runs this on every push (see `vercel.json`).
- Opening the `.html` files directly still works: they show their own built-in text. Sections that start hidden are wrapped in `<template>`, which the browser never renders.

## Adding an editable spot

1. Add the attribute in the HTML, for example `<h2 data-cms="perks.heading">`. Use `global.` keys for content that appears on every page.
2. Run `npm run extract`. It copies the current HTML values into `content/*.json` without touching existing values, and regenerates the field list in `admin/config.yml`, below the marker line.
3. Commit the HTML, `content/` and `admin/config.yml`.

Out of scope for now: navigation, the legal modals, SEO meta tags and the JSON-LD block (these still hold the studio's email and address), and the Google Map on the contact page.

## One-time setup

1. **Vercel**: import `rafaelmassimo/ForgeStudio`, framework preset "Other". `vercel.json` supplies the build command and output folder.
2. **DecapBridge** ([decapbridge.com](https://decapbridge.com)): sign up, add the site, connect a fine-grained GitHub token for this repository only (Contents: read and write), and set the CMS URL to `https://<domain>/admin/`. Check that the free plan still covers one site and one editor.
3. Replace the `backend:` block at the top of `admin/config.yml` with the one DecapBridge shows, then commit.
4. Invite the client's email from DecapBridge.

## Testing locally

```bash
npm install
npm run build
npx serve dist
```

To try the editor without logging in, run `npx decap-server` in the repo root in a second terminal, then open `http://localhost:3000/admin/`. Saves go straight to the local `content/` files, so rebuild to see them.
