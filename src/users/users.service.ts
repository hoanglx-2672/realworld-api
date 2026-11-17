import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import type { AuthContext, JwtPayload } from '../auth/auth.types.js';
import { tokenInvalidException } from '../auth/auth.utils.js';
import {
  errorsException,
  uniqueViolationColumn,
} from '../common/http-errors.js';
import type { LoginUserDto } from './dto/login-user.dto.js';
import type { RegisterUserDto } from './dto/register-user.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import { User } from './user.entity.js';
import { toUserView } from './user.mapper.js';
import type { UserView } from './user.types.js';
import { BCRYPT_COST, DUMMY_HASH } from './users.constants.js';
import { normalizeEmail } from './users.utils.js';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterUserDto): Promise<UserView> {
    const email = normalizeEmail(dto.email);
    await this.assertAvailable(dto.username, email);

    const user = this.users.create({
      username: dto.username,
      email,
      password: await hash(dto.password, BCRYPT_COST),
      bio: null,
      image: null,
    });
    await this.saveOrConflict(user);
    return toUserView(user, await this.signToken(user));
  }

  async login(dto: LoginUserDto): Promise<UserView> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.password') // password có select: false
      .where('user.email = :email', { email: normalizeEmail(dto.email) })
      .getOne();

    const ok = await compare(dto.password, user?.password ?? DUMMY_HASH);
    if (!user || !ok) {
      // Cùng một câu cho "sai email" và "sai mật khẩu".
      throw errorsException(
        HttpStatus.UNAUTHORIZED,
        'credentials',
        'errors.invalid',
      );
    }
    return toUserView(user, await this.signToken(user));
  }

  /** GET /user: trả lại đúng token đang dùng, không tự gia hạn phiên khi chỉ đọc. */
  async getCurrent(auth: AuthContext): Promise<UserView> {
    return toUserView(await this.findByIdOrThrow(auth.userId), auth.token);
  }

  async update(userId: number, dto: UpdateUserDto): Promise<UserView> {
    const user = await this.findByIdOrThrow(userId);
    const email =
      dto.email === undefined ? undefined : normalizeEmail(dto.email);

    if (dto.username !== undefined || email !== undefined) {
      await this.assertAvailable(
        dto.username ?? user.username,
        email ?? user.email,
        user.id,
      );
    }
    const patch: Partial<User> = {};
    if (dto.username !== undefined) patch.username = dto.username;
    if (email !== undefined) patch.email = email;
    // Không thu hồi token cũ khi đổi mật khẩu: bộ test chính thức của RealWorld
    // đổi mật khẩu rồi dùng tiếp token cũ (ISS-03).
    if (dto.password !== undefined) {
      patch.password = await hash(dto.password, BCRYPT_COST);
    }
    // bio/image: "" và null đều nghĩa là "xoá" → lưu null.
    if (dto.bio !== undefined) patch.bio = dto.bio || null;
    if (dto.image !== undefined) patch.image = dto.image || null;

    await this.updateOrConflict(user.id, patch);
    return toUserView(Object.assign(user, patch), await this.signToken(user));
  }

  /**
   * UPDATE ... WHERE id (không dùng save): nếu user bị xoá giữa lúc đọc và ghi, save() sẽ
   * chuyển sang INSERT thiếu password → 500. Ở đây không dòng nào bị sửa → 401 như token hỏng.
   */
  private async updateOrConflict(id: number, patch: Partial<User>) {
    if (!Object.keys(patch).length) return; // PUT {} : không có gì để ghi
    try {
      const result = await this.users.update({ id }, patch);
      if (!result.affected) throw tokenInvalidException();
    } catch (error) {
      throw this.conflictOr(error);
    }
  }

  /** Token hợp lệ nhưng user không còn (đã bị xoá) → coi như token không hợp lệ. */
  private async findByIdOrThrow(id: number): Promise<User> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw tokenInvalidException();
    return user;
  }

  private signToken(user: User): Promise<string> {
    // Chỉ id: đổi username/email không làm token cũ mất hiệu lực.
    const payload: JwtPayload = { sub: user.id };
    return this.jwt.signAsync(payload);
  }

  /** 409 nếu username/email đã thuộc về user khác (`exceptId`: chính mình khi cập nhật). */
  private async assertAvailable(
    username: string,
    email: string,
    exceptId?: number,
  ) {
    const owners = await this.users.find({ where: [{ username }, { email }] });
    const others = owners.filter((u) => u.id !== exceptId);
    if (others.some((u) => u.username === username)) {
      throw errorsException(HttpStatus.CONFLICT, 'username', 'errors.taken');
    }
    if (others.length) {
      throw errorsException(HttpStatus.CONFLICT, 'email', 'errors.taken');
    }
  }

  /** Lưu; nếu hai request đua nhau qua được assertAvailable thì DB chặn → vẫn trả 409. */
  private async saveOrConflict(user: User): Promise<User> {
    try {
      return await this.users.save(user);
    } catch (error) {
      throw this.conflictOr(error);
    }
  }

  /** Lỗi unique của Postgres → 409 {"errors": {"<cột>": ["has already been taken"]}}; lỗi khác giữ nguyên. */
  private conflictOr(error: unknown): unknown {
    const column = uniqueViolationColumn(error);
    return column
      ? errorsException(HttpStatus.CONFLICT, column, 'errors.taken')
      : error;
  }
}
