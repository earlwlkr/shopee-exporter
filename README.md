# Shopee Order Exporter

A Next.js 14 + Tailwind CSS dashboard to export Shopee order data via the [Shopee Open API v2.0](https://open.shopee.com/documents).

## Features

- Input fields for **Partner ID**, **Partner Key**, **Shop ID**, and **Access Token**
- Toggle between **Test** and **Live** environments
- **Date range picker** (defaults to today)
- **Export to CSV** button — fetches `get_order_list` then `get_order_detail` (in batches of 50) and downloads the result
- HMAC-SHA256 signature generation following the Shopee Open API v2.0 spec

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Route

All Shopee API calls are made server-side via `/api/export` to keep your partner key and access token out of the browser.

## Environment Variables

No environment variables are required — credentials are entered in the UI at runtime and never stored.

## Deployment

Deploy to Vercel with one click or via the Vercel CLI.
