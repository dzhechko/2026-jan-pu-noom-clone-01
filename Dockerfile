# Development stage
FROM node:20-alpine AS development
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN npm install
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/
RUN cd apps/api && npx prisma generate
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production stage
FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app
COPY package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN npm install
COPY apps/api/ ./apps/api/
COPY packages/shared/ ./packages/shared/
RUN cd apps/api && npx prisma generate
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/.next/standalone ./
COPY --from=builder /app/apps/api/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/apps/api/prisma ./prisma
EXPOSE 3000
CMD ["node", "server.js"]
