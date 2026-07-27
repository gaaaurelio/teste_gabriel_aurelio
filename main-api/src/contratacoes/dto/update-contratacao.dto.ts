import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length } from 'class-validator';

/**
 * Atualizacao dos dados cadastrais. O status tem endpoint proprio porque tem
 * regra de transicao e delay artificial -- misturar as duas coisas no mesmo
 * PATCH obrigaria o cliente a pagar o delay para renomear um cliente.
 */
export class UpdateContratacaoDto {
  @IsOptional()
  @IsString({ message: 'nomeCliente deve ser uma string' })
  @Length(3, 120, { message: 'nomeCliente deve ter entre 3 e 120 caracteres' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  nomeCliente?: string;

  @IsOptional()
  @IsEmail({}, { message: 'email deve ser um endereco de e-mail valido' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email?: string;

  @IsOptional()
  @IsString({ message: 'produto deve ser uma string' })
  @Length(2, 80, { message: 'produto deve ter entre 2 e 80 caracteres' })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  produto?: string;
}
