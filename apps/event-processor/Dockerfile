FROM node:24-alpine

WORKDIR /workspace

COPY package.json package.json
COPY tsconfig.base.json tsconfig.base.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/event-processor/package.json apps/event-processor/package.json

RUN npm install

COPY packages/shared packages/shared
COPY apps/event-processor apps/event-processor

WORKDIR /workspace/apps/event-processor

EXPOSE 3002

CMD ["npm", "run", "dev"]
