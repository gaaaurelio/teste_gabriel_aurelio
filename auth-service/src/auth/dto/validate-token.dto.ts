import { IsNotEmpty, IsString } from 'class-validator';

export class ValidateTokenDto {
  @IsString({ message: 'token deve ser uma string' })
  @IsNotEmpty({ message: 'token e obrigatorio' })
  token!: string;
}
