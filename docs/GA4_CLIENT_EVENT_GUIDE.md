# GA4 Client Event Guide

Use this guide when connecting a client website or backend to the SST event gateway for Google Analytics 4.

## Goal

GA4 only becomes useful when client systems send real business events with enough context to power:

- Realtime activity
- Debug validation
- Ecommerce reporting
- Revenue and transaction reporting
- Funnel analysis for product views, cart, checkout, and purchase

Your gateway already forwards server-side events to GA4. To make the reporting meaningful, clients should send a consistent set of events and fields.

## Send Events To

Send JSON to your gateway ingestion endpoint:

```text
POST /events/ingest
Content-Type: application/json
```

## Recommended Top-Level Fields

These fields match the current project schema in `packages/shared/src/index.ts`.

```json
{
  "eventName": "purchase",
  "clientId": "1234567890.1234567890",
  "sessionId": "1712312345",
  "pageUrl": "https://shop.example.com/checkout/success",
  "referrer": "https://shop.example.com/checkout",
  "currency": "USD",
  "revenue": 149.99,
  "destinations": ["ga4"],
  "properties": {}
}
```

## Fields Clients Should Always Send

- `eventName`: the business event name
- `clientId`: stable browser or device identifier
- `sessionId`: session identifier for GA4 Realtime and session stitching
- `pageUrl`: the page where the event happened
- `referrer`: previous page when available
- `destinations`: include `ga4`
- `currency`: 3-letter ISO code such as `USD`
- `revenue`: send for monetized events
- `properties.engagement_time_msec`: recommended for better GA4 processing

## Ecommerce Fields That Matter Most

For meaningful reporting, clients should send these inside `properties` when relevant:

- `transaction_id` or `order_id`
- `coupon`
- `shipping`
- `tax`
- `payment_type`
- `shipping_tier`
- `affiliation`
- `item_list_id`
- `item_list_name`
- `promotion_id`
- `promotion_name`
- `items`

Recommended `items[]` structure:

```json
[
  {
    "item_id": "sku-red-shirt-01",
    "item_name": "Red Shirt",
    "item_brand": "Acme",
    "item_category": "Apparel",
    "item_category2": "Shirts",
    "item_variant": "XL",
    "price": 49.99,
    "quantity": 2,
    "discount": 5
  }
]
```

## Minimum Event Set For Useful GA4 Reporting

Clients should send at least these events:

- `page_view`
- `view_item`
- `add_to_cart`
- `begin_checkout`
- `add_shipping_info`
- `add_payment_info`
- `purchase`

Optional but recommended:

- `view_cart`
- `remove_from_cart`
- `view_item_list`
- `select_item`
- `refund`
- `sign_up`
- `login`
- `search`

## Example Payloads

### 1. Page View

```json
{
  "eventName": "page_view",
  "clientId": "1234567890.1234567890",
  "sessionId": "1712312345",
  "pageUrl": "https://shop.example.com/products/red-shirt",
  "referrer": "https://google.com/search?q=red+shirt",
  "destinations": ["ga4"],
  "properties": {
    "page_title": "Red Shirt",
    "engagement_time_msec": 1000
  }
}
```

### 2. View Item

```json
{
  "eventName": "view_item",
  "clientId": "1234567890.1234567890",
  "sessionId": "1712312345",
  "pageUrl": "https://shop.example.com/products/red-shirt",
  "currency": "USD",
  "destinations": ["ga4"],
  "properties": {
    "page_title": "Red Shirt",
    "value": 49.99,
    "engagement_time_msec": 1000,
    "items": [
      {
        "item_id": "sku-red-shirt-01",
        "item_name": "Red Shirt",
        "item_brand": "Acme",
        "item_category": "Apparel",
        "item_category2": "Shirts",
        "item_variant": "XL",
        "price": 49.99,
        "quantity": 1
      }
    ]
  }
}
```

### 3. Add To Cart

```json
{
  "eventName": "add_to_cart",
  "clientId": "1234567890.1234567890",
  "sessionId": "1712312345",
  "pageUrl": "https://shop.example.com/products/red-shirt",
  "currency": "USD",
  "revenue": 99.98,
  "destinations": ["ga4"],
  "properties": {
    "engagement_time_msec": 1000,
    "items": [
      {
        "item_id": "sku-red-shirt-01",
        "item_name": "Red Shirt",
        "item_brand": "Acme",
        "item_category": "Apparel",
        "item_category2": "Shirts",
        "item_variant": "XL",
        "price": 49.99,
        "quantity": 2
      }
    ]
  }
}
```

### 4. Begin Checkout

```json
{
  "eventName": "begin_checkout",
  "clientId": "1234567890.1234567890",
  "sessionId": "1712312345",
  "pageUrl": "https://shop.example.com/checkout",
  "currency": "USD",
  "revenue": 109.98,
  "destinations": ["ga4"],
  "properties": {
    "coupon": "SUMMER10",
    "engagement_time_msec": 1000,
    "items": [
      {
        "item_id": "sku-red-shirt-01",
        "item_name": "Red Shirt",
        "item_brand": "Acme",
        "item_category": "Apparel",
        "price": 49.99,
        "quantity": 2
      }
    ]
  }
}
```

### 5. Add Shipping Info

```json
{
  "eventName": "add_shipping_info",
  "clientId": "1234567890.1234567890",
  "sessionId": "1712312345",
  "pageUrl": "https://shop.example.com/checkout/shipping",
  "currency": "USD",
  "revenue": 114.98,
  "destinations": ["ga4"],
  "properties": {
    "shipping_tier": "Express",
    "shipping": 4.99,
    "engagement_time_msec": 1000,
    "items": [
      {
        "item_id": "sku-red-shirt-01",
        "item_name": "Red Shirt",
        "price": 49.99,
        "quantity": 2
      }
    ]
  }
}
```

### 6. Add Payment Info

```json
{
  "eventName": "add_payment_info",
  "clientId": "1234567890.1234567890",
  "sessionId": "1712312345",
  "pageUrl": "https://shop.example.com/checkout/payment",
  "currency": "USD",
  "revenue": 114.98,
  "destinations": ["ga4"],
  "properties": {
    "payment_type": "card",
    "engagement_time_msec": 1000,
    "items": [
      {
        "item_id": "sku-red-shirt-01",
        "item_name": "Red Shirt",
        "price": 49.99,
        "quantity": 2
      }
    ]
  }
}
```

### 7. Purchase

```json
{
  "eventName": "purchase",
  "clientId": "1234567890.1234567890",
  "sessionId": "1712312345",
  "pageUrl": "https://shop.example.com/checkout/success",
  "referrer": "https://shop.example.com/checkout/payment",
  "currency": "USD",
  "revenue": 114.98,
  "destinations": ["ga4"],
  "properties": {
    "transaction_id": "ORDER-100045",
    "coupon": "SUMMER10",
    "shipping": 4.99,
    "tax": 10,
    "payment_type": "card",
    "shipping_tier": "Express",
    "affiliation": "Online Store",
    "engagement_time_msec": 1000,
    "items": [
      {
        "item_id": "sku-red-shirt-01",
        "item_name": "Red Shirt",
        "item_brand": "Acme",
        "item_category": "Apparel",
        "item_category2": "Shirts",
        "item_variant": "XL",
        "price": 49.99,
        "quantity": 2,
        "discount": 5
      }
    ]
  }
}
```

## What This Produces In GA4

When clients send the events above consistently, GA4 can show:

- live user activity in Realtime
- validated test activity in DebugView
- purchase revenue
- transaction-level reporting
- product and item performance
- cart and checkout progression
- coupon, shipping, and tax context

## Validation Checklist

Before telling a client GA4 is fully working, confirm:

- the GA4 gateway card is `Verified`
- the client is sending real events to `/events/ingest`
- `clientId` and `sessionId` are present
- `purchase` includes `transaction_id` and `items`
- `currency` and `revenue` are sent on monetized events
- your server logs show successful GA4 delivery

## Common Mistakes

- Sending only `page_view` and expecting revenue reports
- Omitting `transaction_id` on purchases
- Sending `purchase` without `items`
- Omitting `sessionId`, which weakens Realtime usefulness
- Sending raw PII to GA4 in custom fields
- Using inconsistent product IDs across events

## Best Practice

For most ecommerce clients, the minimum production rollout should be:

1. `page_view`
2. `view_item`
3. `add_to_cart`
4. `begin_checkout`
5. `purchase`

If the client wants stronger checkout analysis, also add:

1. `add_shipping_info`
2. `add_payment_info`
3. `refund`
