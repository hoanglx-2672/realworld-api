import { HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { compare, hash } from 'bcryptjs';
import { Repository } from 'typeorm';
import {
  errorsException,
  uniqueViolationColumn,
} from '../common/http-errors.js';
import type { LoginUserDto } from './dto/login-user.dto.js';
import type { RegisterUserDto } from './dto/register-user.dto.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { AuthContext, JwtPayload } from '../auth/jwt-auth.guard.js';
import { User } from './user.entity.js';
import { toUserView, type UserView } from './user.mapper.js';

const BCRYPT_COST = 10;
/**
 * Hash giả để so khi email không tồn tại: login mất cùng thời gian dù email
 * có hay không, kẻ dò không đoán được email nào đã đăng ký qua thời gian phản hồi.
 */
// Tính sẵn (cost = BCRYPT_COST, mật khẩu ngẫu nhiên đã bỏ): không chặn event loop lúc import.
const DUMMY_HASH =
  '$2b$10$hQdrVIjDsLNzdvTVd0ffwOM7dJ/ORlIrI2ydpUhQ/5JwsfRtUq3dC';

/** Email không phân biệt hoa thường: `Jake@x.com` và `jake@x.com` là một người. */
export const normalizeEmail = (email: string) => email.trim().toLowerCase();

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
    // Không thu hồi token cũ khi đổi mật khẩu: bộ test chính thức (errors_auth.hurl:240–261)
    // đổi mật khẩu rồi dùng tiếp token cũ. Xem ISS-03 trong docs/tracker.html.
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
      if (!result.affected) throw this.tokenInvalid();
    } catch (error) {
      const column = uniqueViolationColumn(error);
      if (column)
        throw errorsException(HttpStatus.CONFLICT, column, 'errors.taken');
      throw error;
    }
  }

  private tokenInvalid() {
    return errorsException(
      HttpStatus.UNAUTHORIZED,
      'token',
      'errors.tokenInvalid',
    );
  }

  /** Token hợp lệ nhưng user không còn (đã bị xoá) → coi như token không hợp lệ. */
  private async findByIdOrThrow(id: number): Promise<User> {
    const user = await this.users.findOneBy({ id });
    if (!user) throw this.tokenInvalid();
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
      const column = uniqueViolationColumn(error);
      if (column)
        throw errorsException(HttpStatus.CONFLICT, column, 'errors.taken');
      throw error;
    }
  }
}
