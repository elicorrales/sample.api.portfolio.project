# Admin web client

The admin page for managing users: a simple, professional CRUD screen, the kind a company builds for an internal tool. It calls the API hosted on Render and will be hosted on Render too, as a static site ([decision 05](../project/docs/decisions/05-hosting.md#web-client-on-render-not-netlify-2026-09-13)).

**Meant for a big screen** (desktop or laptop, about 1280 px wide or more); there's no phone layout ([decision 13](../project/docs/decisions/13-web-client.md#screen-size-big-screens-only-2026-09-13)).

Not built yet: it's the next step after hosting the API (see [PROGRESS](../PROGRESS.md)). The API's own Swagger docs are served by the API at `/docs`.
