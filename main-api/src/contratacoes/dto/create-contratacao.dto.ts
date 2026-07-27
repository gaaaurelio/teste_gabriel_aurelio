import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length } from 'class-validator';

/**
 * DTO de criacao. O papel aqui e o mesmo de um Form Request do Laravel:
 * garantir que nada chega ao service em formato invalido.
 *
 * O status nao entra no DTO de proposito -- quem cria uma contratacao nao
 * escolhe em que estado ela nasce.
 */
export class CreateContratacaoDto {
  @IsString({ message: 'nomeCliente deve ser uma string' })
  @Length(3, 120, {
    message: 'nomeCliente deve ter entre 3 e 120 caracteres',
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  nomeCliente!: string;

  @IsEmail({}, { message: 'email deve ser um endereco de e-mail valido' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email!: string;

  @IsString({ message: 'produto deve ser uma string' })
  @Length(2, 80, { message: 'produto deve ter entre 2 e 80 caracteres' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  produto!: string;
}
