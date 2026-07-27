import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'email deve ser um endereco de e-mail valido' })
  email!: string;

  @IsString({ message: 'password deve ser uma string' })
  @MinLength(6, { message: 'password deve ter no minimo 6 caracteres' })
  password!: string;
}
