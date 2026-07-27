import { Module } from '@nestjs/common';
import { AuthClientService } from './auth-client.service';
import { S2SAuthGuard } from './s2s-auth.guard';

@Module({
  providers: [AuthClientService, S2SAuthGuard],
  exports: [AuthClientService, S2SAuthGuard],
})
export class AuthModule {}
