FROM node:24-alpine

WORKDIR /workspace

COPY package.json package.json
COPY tsconfig.base.json tsconfig.base.json
COPY packages/shared/package.json packages/shared/package.json
COPY apps/frontend/package.json apps/frontend/package.json

RUN npm install

COPY packages/shared packages/shared
COPY apps/frontend apps/frontend

WORKDIR /workspace/apps/frontend

EXPOSE 3000

CMD ["npm", "run", "dev"]
