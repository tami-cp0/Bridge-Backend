import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  // rawBody: true is required so the Squad webhook controller can verify HMAC signatures
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown fields from request bodies
      forbidNonWhitelisted: true, // throw if client sends unexpected fields
      transform: true, // auto-cast query params to their DTO types (e.g. string → number)
    }),
  );

  const configService = app.get(ConfigService);
  const frontendUrl = configService.get<string>('app.frontendUrl');
  const origins = [
    'http://localhost:3000',
    ...(frontendUrl
      ? frontendUrl.split(',').map((origin) => origin.trim())
      : []),
  ].filter(Boolean);

  app.enableCors({
    origin: origins,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('Bridge API')
    .setDescription('Bridge MVP — revenue-share financing platform API')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'JWT',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get<number>('app.port') ?? 3005;
  await app.listen(port);
}
bootstrap().catch((err) => {
  console.error('Bootstrap failed', err);
  process.exit(1);
});
