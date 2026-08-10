import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: [
      process.env.CORS_ORIGIN || 'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:3002',
    ],
    credentials: true,
  });
  app.setGlobalPrefix('api/v1');

  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  const config = new DocumentBuilder()
    .setTitle('FreelancerHisab API')
    .setDescription('API documentation for FreelancerHisab')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  let port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
  const maxPort = port + 10;
  
  while (port <= maxPort) {
    try {
      await app.listen(port);
      console.log(`🚀 FreelancerHisab API server running on http://localhost:${port}/api/v1`);
      console.log(`📚 Swagger API Docs available at http://localhost:${port}/api/docs`);
      break;
    } catch (error: any) {
      if (error.code === 'EADDRINUSE') {
        console.warn(`⚠️  Port ${port} is in use, trying ${port + 1}...`);
        port++;
      } else {
        throw error;
      }
    }
  }
}
bootstrap();
