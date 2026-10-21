# Agula Quiz-ийг ажилтны порталд суулгах

Agula Quiz-ийг хоёр аргаар ажиллуулж болно. Хоёулаа ямар нэг төлбөртэй үйлчилгээ, гадны API шаардахгүй.

| | А. Тусдаа домэйн | Б. Порталын дэд зам |
| --- | --- | --- |
| Хаяг | `https://quiz.agula.mn` | `https://portal.agula.mn/quiz/` |
| HTTPS | Caddy автоматаар авна | Порталын веб сервер (nginx г.м.) |
| Тохиргоо | [`deploy/`](../README.md) | энэ хавтас |
| Порталд харуулах | цэсний холбоос эсвэл `<iframe>` | цэсний холбоос эсвэл `<iframe>` |

Аль ч аргаар суулгасан ажилтан порталын цэснээс шууд нээж, портал дээрх нэвтрэлтээрээ автоматаар нэвтэрнэ (доорх «Автомат нэвтрэлт»).

---

## Б. Порталын дэд замаар (`/quiz/`)

### 1. Серверт асаах

Порталтай нэг сервер (эсвэл порталын веб серверээс хүрэх боломжтой сервер) дээр:

```bash
cd deploy/portal
cp .env.example .env
# .env-д PORTAL_HOST, POSTGRES_PASSWORD, JWT_SECRET, PORTAL_SSO_SECRET-ийг бөглөнө
docker compose -f docker-compose.portal.yml up -d --build
```

Agula Quiz зөвхөн `127.0.0.1:8090` дээр (дотооддоо) сонсоно.

### 2. Порталын веб серверт нэг дүрэм нэмэх

**nginx:**

```nginx
location /quiz/ {
    proxy_pass http://127.0.0.1:8090/;          # төгсгөлийн "/" нь /quiz угтварыг хасна
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;      # шууд тоглоомын WebSocket
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 1h;
    client_max_body_size 10m;                    # Quiz-ийн зураг оруулах
}
```

**Apache** (`mod_proxy`, `mod_proxy_wstunnel`):

```apache
ProxyPass        /quiz/socket.io/ ws://127.0.0.1:8090/socket.io/
ProxyPass        /quiz/           http://127.0.0.1:8090/
ProxyPassReverse /quiz/           http://127.0.0.1:8090/
```

IIS дээр URL Rewrite + ARR-аар `/quiz/(.*)` → `http://127.0.0.1:8090/{R:1}` гэж мөн адил дамжуулна (WebSocket-ийг идэвхжүүлнэ).

`QUIZ_PATH`-ийг өөрчилбөл (жишээ нь `/game`) дүрэм дээрх `/quiz/`-ийг мөн адил солиод `docker compose ... up -d --build`-ээр дахин build хийнэ.

---

## А. Тусдаа домэйн дээр

[`deploy/README.md`](../README.md)-ийн дагуу асаана. Порталд `<iframe>`-ээр харуулах бол `deploy/.env`-д порталын хаягийг нэмнэ:

```bash
FRAME_ANCESTORS=https://portal.agula.mn
PORTAL_SSO_SECRET=...   # доорх автомат нэвтрэлтэд
```

---

## Порталын цэс

Порталын цэсэнд «🎮 Agula Quiz» гэсэн нэг мөр нэмээд дараах хоёрын аль нэгийг хийнэ.

**Шинэ хуудсанд нээх** (хамгийн энгийн):

```html
<a href="/quiz/portal?token=ТОКЕН">🎮 Agula Quiz</a>
```

**Порталын дотор (`<iframe>`) харуулах:**

```html
<iframe src="/quiz/portal?token=ТОКЕН&next=/"
        style="width:100%; height:calc(100vh - 64px); border:0"
        allow="fullscreen; autoplay; clipboard-write"></iframe>
```

Тусдаа домэйнтой бол `/quiz/`-ийн оронд `https://quiz.agula.mn/` гэж бичнэ.

Iframe дотор Quiz хөтлөхөд хөтлөгчийн (проекторын) дэлгэц шинэ цонхонд нээгдэнэ. Тоглогчид, дадлага, Leaderboard, профайл бүгд iframe дотроо ажиллана.

`next`-д дараах замуудыг өгч болно: `/` (нүүр), `/quizzes` (Quiz-ийн сан), `/join` (PIN оруулах), `/leaderboard`, `/me`.

---

## Автомат нэвтрэлт (SSO)

Портал ажилтныг аль хэдийн таньдаг тул Agula Quiz-д дахин бүртгүүлэх шаардлагагүй. Портал богино хугацаатай гарын үсэгтэй токен (HS256 JWT) үүсгэж холбоосонд залгана. Agula Quiz тухайн ажилтны бүртгэлийг анх орохдоо автоматаар үүсгэж, нэр, хэлтсийг нь портал дээрхтэй тааруулна.

1. Нууц түлхүүр үүсгэнэ: `openssl rand -hex 32`. Үүнийг Agula Quiz-ийн `.env`-д `PORTAL_SSO_SECRET`, мөн порталын серверийн тохиргоонд хадгална. Хоёр талд яг адилхан байна.
2. Портал цэсний холбоосыг харуулах бүрдээ (сервер талд) токен үүсгэнэ:

| Талбар | Заавал | Утга |
| --- | --- | --- |
| `email` | тийм | ажилтны имэйл; бүртгэлийг үүгээр таньна |
| `name` | үгүй | дэлгэц дээр харагдах нэр |
| `department` | үгүй | хэлтэс (хэлтэс хоорондын тоглолтод) |
| `exp` | тийм | дуусах хугацаа, Unix секундээр; **10 минутаас ихгүй** |

**Node.js** (нэмэлт сангүйгээр):

```js
const crypto = require('node:crypto');
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

function quizToken(user) {
  const head = b64({ alg: 'HS256', typ: 'JWT' });
  const body = b64({
    email: user.email,
    name: user.fullName,
    department: user.department,
    exp: Math.floor(Date.now() / 1000) + 5 * 60,
  });
  const sig = crypto.createHmac('sha256', process.env.PORTAL_SSO_SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}
```

**C# (.NET)**, `System.IdentityModel.Tokens.Jwt` ашиглан:

```csharp
var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(portalSsoSecret));
var token = new JwtSecurityToken(
    claims: new[] { new Claim("email", user.Email), new Claim("name", user.FullName), new Claim("department", user.Department) },
    expires: DateTime.UtcNow.AddMinutes(5),
    signingCredentials: new SigningCredentials(key, SecurityAlgorithms.HmacSha256));
var quizToken = new JwtSecurityTokenHandler().WriteToken(token);
```

**PHP** (`firebase/php-jwt`):

```php
$token = \Firebase\JWT\JWT::encode(
    ['email' => $user->email, 'name' => $user->name, 'department' => $user->department, 'exp' => time() + 300],
    $portalSsoSecret, 'HS256');
```

Аюулгүй байдал:

- Токеныг **зөвхөн сервер талд** үүсгэнэ. `PORTAL_SSO_SECRET` хөтөч рүү хэзээ ч очих ёсгүй.
- Токен 10 минутаас удаан хүчинтэй бол Agula Quiz хүлээж авахгүй.
- `PORTAL_SSO_SECRET` хоосон бол автомат нэвтрэлт идэвхгүй байна. Ажилтнууд зочноор тоглох эсвэл өөрсдөө бүртгүүлэх боломжтой хэвээр.

---

## Шалгах

1. `https://portal.agula.mn/quiz/` нээгдэж, Quiz-ийн сан харагдана.
2. Цэсний холбоосоор ороход дээд буланд ажилтны нэр харагдана.
3. Нэг утсаар PIN оруулж нэгдэхэд тоглоом шууд явна (WebSocket ажиллаж байна).

Асуудал гарвал: `docker compose -f docker-compose.portal.yml logs -f api gateway`.
