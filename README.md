# Pagebrew

Zero-config static site generator for your markdown files.


## Usage

Generate a static site:
```bash
npx pagebrew <input> <output>
```

- `<input>` is the directory containing your markdown files.
- `<output>` is the directory to output the generated site to.

## Options

- `-s` or `--serve` - Serve the site locally (also watches for changes)
- `-w` or `--watch` - Watch for changes and rebuild the site

Serve the site locally :
```bash
npx pagebrew <input> <output> -s
```

Watch for changes and rebuild the site:
```bash
npx pagebrew <input> <output> -w
```


## Features

- Generate a static site from Markdown files
- Use Tailwind CSS for styling
- Use EJS for templating
- Deploy the site to a static host


## Deployment (WIP)

- Cloudflare Pages
- Vercel
- Netlify
- GitHub Pages