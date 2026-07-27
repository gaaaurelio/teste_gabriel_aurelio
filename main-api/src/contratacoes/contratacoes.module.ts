import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AtrasoArtificialInterceptor } from './atraso-artificial.interceptor';
import { ContratacoesController } from './contratacoes.controller';
import { ContratacoesService } from './contratacoes.service';

@Module({
  imports: [AuthModule],
  controllers: [ContratacoesController],
  providers: [ContratacoesService, AtrasoArtificialInterceptor],
})
export class ContratacoesModule {}
