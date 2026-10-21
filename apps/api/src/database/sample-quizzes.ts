import type { QuizInput } from '@quiz/shared';

/**
 * Ready-made quizzes seeded into every database. Ids are fixed so re-seeding
 * updates them in place. Flag images live in apps/web/public/samples.
 */
export const SAMPLE_QUIZZES: { id: string; quiz: QuizInput }[] = [
  {
    id: 'sample-mongolia',
    quiz: {
      title: 'Монголын түүх, газарзүй',
      description: 'Эх орныхоо түүх, газарзүйн мэдлэгээ сориорой.',
      language: 'mn',
      rounds: [
        {
          name: 'Халаалт',
          type: 'normal',
          timePerQuestion: 20,
          shuffleAnswers: true,
          questions: [
            {
              type: 'single',
              prompt: 'Монгол Улсын нийслэл аль хот вэ?',
              options: [
                { id: 'a', text: 'Улаанбаатар' },
                { id: 'b', text: 'Дархан' },
                { id: 'c', text: 'Эрдэнэт' },
                { id: 'd', text: 'Чойбалсан' },
              ],
              correct: ['a'],
            },
            {
              type: 'true_false',
              prompt: 'Хөвсгөл нуур бол Монголын хамгийн гүн нуур юм.',
              correct: true,
              explanation: 'Хөвсгөл нуурын хамгийн гүн цэг нь 262 метр.',
            },
            {
              type: 'single',
              prompt: 'Монголын хамгийн өндөр оргил аль нь вэ?',
              options: [
                { id: 'a', text: 'Хүйтэн оргил' },
                { id: 'b', text: 'Отгонтэнгэр' },
                { id: 'c', text: 'Сутай хайрхан' },
                { id: 'd', text: 'Цамбагарав' },
              ],
              correct: ['a'],
              explanation: 'Алтай Таван Богдын Хүйтэн оргил 4374 метр өндөр.',
            },
            {
              type: 'multiple',
              prompt: 'Монгол Улс аль улсуудтай хиллэдэг вэ?',
              options: [
                { id: 'a', text: 'ОХУ' },
                { id: 'b', text: 'БНХАУ' },
                { id: 'c', text: 'Казахстан' },
                { id: 'd', text: 'Солонгос' },
              ],
              correct: ['a', 'b'],
            },
          ],
        },
        {
          name: 'Хурдан тойрог',
          type: 'speed',
          timePerQuestion: 10,
          questions: [
            {
              type: 'type_answer',
              prompt: 'Их Монгол Улс хэдэн онд байгуулагдсан бэ?',
              acceptedAnswers: ['1206'],
              timeLimit: 15,
            },
            {
              type: 'ordering',
              prompt: 'Үйл явдлуудыг цаг хугацааны дарааллаар эрэмбэлнэ үү.',
              items: [
                { id: 'a', text: 'Их Монгол Улс байгуулагдсан' },
                { id: 'b', text: 'Юань улс байгуулагдсан' },
                { id: 'c', text: 'Монгол тусгаар тогтнолоо зарласан' },
                { id: 'd', text: 'Ардчилсан хувьсгал' },
              ],
              timeLimit: 25,
            },
            {
              type: 'true_false',
              prompt: 'Монгол Улс 21 аймагтай.',
              correct: true,
            },
            {
              type: 'single',
              prompt: 'Үндэсний их баяр наадмыг жил бүрийн хэдэн сард тэмдэглэдэг вэ?',
              options: [
                { id: 'a', text: '7-р сар' },
                { id: 'b', text: '6-р сар' },
                { id: 'c', text: '8-р сар' },
                { id: 'd', text: '5-р сар' },
              ],
              correct: ['a'],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'sample-general',
    quiz: {
      title: 'Ерөнхий мэдлэг',
      description: 'Шинжлэх ухаан, байгаль, дэлхийн тухай хөгжилтэй асуултууд.',
      language: 'mn',
      rounds: [
        {
          name: 'Шинжлэх ухаан',
          questions: [
            {
              type: 'single',
              prompt: 'Усны химийн томьёо юу вэ?',
              options: [
                { id: 'a', text: 'H₂O' },
                { id: 'b', text: 'CO₂' },
                { id: 'c', text: 'O₂' },
                { id: 'd', text: 'NaCl' },
              ],
              correct: ['a'],
            },
            {
              type: 'true_false',
              prompt: 'Нар бол од юм.',
              correct: true,
            },
            {
              type: 'single',
              prompt: 'Нарны аймгийн хамгийн том гариг аль нь вэ?',
              options: [
                { id: 'a', text: 'Бархасбадь' },
                { id: 'b', text: 'Санчир' },
                { id: 'c', text: 'Дэлхий' },
                { id: 'd', text: 'Ангараг' },
              ],
              correct: ['a'],
            },
            {
              type: 'multiple',
              prompt: 'Эдгээрээс аль нь хөхтөн амьтан бэ?',
              options: [
                { id: 'a', text: 'Халим' },
                { id: 'b', text: 'Сарьсан багваахай' },
                { id: 'c', text: 'Акул' },
                { id: 'd', text: 'Оцон шувуу' },
              ],
              correct: ['a', 'b'],
            },
          ],
        },
        {
          name: 'Давхар оноо',
          type: 'double',
          pointsMultiplier: 2,
          questions: [
            {
              type: 'type_answer',
              prompt: 'Насанд хүрсэн хүн ихэвчлэн хэдэн шүдтэй байдаг вэ?',
              acceptedAnswers: ['32'],
            },
            {
              type: 'ordering',
              prompt: 'Гаригуудыг Нарнаас ойроос нь эхлэн эрэмбэлнэ үү.',
              items: [
                { id: 'a', text: 'Буд' },
                { id: 'b', text: 'Сугар' },
                { id: 'c', text: 'Дэлхий' },
                { id: 'd', text: 'Ангараг' },
              ],
            },
            {
              type: 'image',
              prompt: 'Энэ аль улсын төрийн далбаа вэ?',
              imageUrl: '/samples/flags/japan.svg',
              options: [
                { id: 'a', text: 'Япон' },
                { id: 'b', text: 'Өмнөд Солонгос' },
                { id: 'c', text: 'Хятад' },
                { id: 'd', text: 'Вьетнам' },
              ],
              correct: ['a'],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'sample-capitals',
    quiz: {
      title: 'World Capitals',
      description: 'A trip around the world in three rounds.',
      language: 'en',
      rounds: [
        {
          name: 'Europe',
          shuffleAnswers: true,
          questions: [
            {
              type: 'single',
              prompt: 'What is the capital of France?',
              options: [
                { id: 'a', text: 'Paris' },
                { id: 'b', text: 'Lyon' },
                { id: 'c', text: 'Marseille' },
                { id: 'd', text: 'Nice' },
              ],
              correct: ['a'],
            },
            {
              type: 'single',
              prompt: 'What is the capital of Germany?',
              options: [
                { id: 'a', text: 'Berlin' },
                { id: 'b', text: 'Munich' },
                { id: 'c', text: 'Hamburg' },
                { id: 'd', text: 'Frankfurt' },
              ],
              correct: ['a'],
            },
            {
              type: 'true_false',
              prompt: 'Madrid is the capital of Portugal.',
              correct: false,
              explanation: 'Lisbon is the capital of Portugal; Madrid is the capital of Spain.',
            },
            {
              type: 'type_answer',
              prompt: 'What is the capital of Italy?',
              acceptedAnswers: ['Rome', 'Roma'],
            },
          ],
        },
        {
          name: 'Asia',
          type: 'speed',
          timePerQuestion: 10,
          questions: [
            {
              type: 'single',
              prompt: 'What is the capital of Japan?',
              options: [
                { id: 'a', text: 'Tokyo' },
                { id: 'b', text: 'Osaka' },
                { id: 'c', text: 'Kyoto' },
                { id: 'd', text: 'Yokohama' },
              ],
              correct: ['a'],
            },
            {
              type: 'multiple',
              prompt: 'Which of these are capital cities?',
              options: [
                { id: 'a', text: 'Ulaanbaatar' },
                { id: 'b', text: 'Seoul' },
                { id: 'c', text: 'Shanghai' },
                { id: 'd', text: 'Mumbai' },
              ],
              correct: ['a', 'b'],
              timeLimit: 15,
            },
            {
              type: 'image',
              prompt: 'Which country does this flag belong to?',
              imageUrl: '/samples/flags/germany.svg',
              options: [
                { id: 'a', text: 'Germany' },
                { id: 'b', text: 'Belgium' },
                { id: 'c', text: 'Spain' },
                { id: 'd', text: 'Austria' },
              ],
              correct: ['a'],
            },
          ],
        },
        {
          name: 'Final',
          type: 'elimination',
          questions: [
            {
              type: 'ordering',
              prompt: 'Order these cities from west to east.',
              items: [
                { id: 'a', text: 'Lisbon' },
                { id: 'b', text: 'Paris' },
                { id: 'c', text: 'Moscow' },
                { id: 'd', text: 'Tokyo' },
              ],
            },
            {
              type: 'true_false',
              prompt: 'Canberra is the capital of Australia.',
              correct: true,
            },
            {
              type: 'image',
              prompt: 'Whose flag is this?',
              imageUrl: '/samples/flags/france.svg',
              options: [
                { id: 'a', text: 'France' },
                { id: 'b', text: 'Netherlands' },
                { id: 'c', text: 'Italy' },
                { id: 'd', text: 'Russia' },
              ],
              correct: ['a'],
            },
          ],
        },
      ],
    },
  },
  {
    id: 'sample-science',
    quiz: {
      title: 'Science & Nature',
      description: 'Quick-fire science questions for curious minds.',
      language: 'en',
      rounds: [
        {
          name: 'Lightning round',
          timePerQuestion: 15,
          questions: [
            {
              type: 'single',
              prompt: 'Which gas do plants take in from the air for photosynthesis?',
              options: [
                { id: 'a', text: 'Carbon dioxide' },
                { id: 'b', text: 'Oxygen' },
                { id: 'c', text: 'Nitrogen' },
                { id: 'd', text: 'Helium' },
              ],
              correct: ['a'],
            },
            {
              type: 'true_false',
              prompt: 'Sound travels faster in water than in air.',
              correct: true,
            },
            {
              type: 'type_answer',
              prompt: 'What is the chemical symbol for gold?',
              acceptedAnswers: ['Au'],
            },
            {
              type: 'multiple',
              prompt: 'Which of these are planets in our solar system?',
              options: [
                { id: 'a', text: 'Mars' },
                { id: 'b', text: 'Neptune' },
                { id: 'c', text: 'Pluto' },
                { id: 'd', text: 'The Moon' },
              ],
              correct: ['a', 'b'],
              explanation: 'Pluto was reclassified as a dwarf planet in 2006.',
            },
            {
              type: 'ordering',
              prompt: 'Order from smallest to largest.',
              items: [
                { id: 'a', text: 'Atom' },
                { id: 'b', text: 'Cell' },
                { id: 'c', text: 'Ant' },
                { id: 'd', text: 'Elephant' },
              ],
            },
          ],
        },
      ],
    },
  },
];
