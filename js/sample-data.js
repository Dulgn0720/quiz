// Default question set. Any data in this shape (or CSV) can be imported from the UI.
export const SAMPLE_SET = {
  name: 'Ерөнхий мэдлэг (жишээ)',
  questions: [
    // ---- Монгол түүх ----
    { category: 'Монгол түүх', difficulty: 1, question: 'Чингис хаан Их Монгол Улсыг хэдэн онд байгуулсан бэ?', options: ['1162', '1206', '1227', '1260'], answer: '1206', explanation: '1206 онд Онон голын эхэнд хуралдсан их хуралдайгаар Тэмүжинийг Чингис хаан хэмээн өргөмжилсөн.' },
    { category: 'Монгол түүх', difficulty: 1, question: 'Монгол бичиг дээрээс доош босоо бичигддэг.', answer: true },
    { category: 'Монгол түүх', difficulty: 2, question: 'Хархорумыг нийслэл болгон барьж байгуулсан хаан хэн бэ?', options: ['Чингис хаан', 'Өгөдэй хаан', 'Хубилай хаан', 'Мөнх хаан'], answer: 'Өгөдэй хаан' },
    { category: 'Монгол түүх', difficulty: 2, question: 'Юань улсыг байгуулсан хаан хэн бэ?', options: ['Хубилай хаан', 'Гүюг хаан', 'Батхаан', 'Өгөдэй хаан'], answer: 0 },
    { category: 'Монгол түүх', difficulty: 2, question: 'Монголын анхны сансрын нисгэгч хэн бэ?', options: ['Ж.Гүррагчаа', 'Ю.Цэдэнбал', 'Ж.Самбуу', 'Д.Сүхбаатар'], answer: 'Ж.Гүррагчаа', explanation: '1981 онд "Союз-39" хөлгөөр сансарт ниссэн.' },
    { category: 'Монгол түүх', difficulty: 3, question: 'Монгол Улс НҮБ-д хэдэн онд элссэн бэ?', options: ['1945', '1955', '1961', '1972'], answer: '1961' },
    { category: 'Монгол түүх', difficulty: 3, question: 'Монголын төгрөг анх хэдэн онд гүйлгээнд гарсан бэ?', type: 'text', answer: ['1925'] },

    // ---- Газарзүй ----
    { category: 'Газарзүй', difficulty: 1, question: 'Монгол Улсын нийслэл хот аль вэ?', type: 'text', answer: ['Улаанбаатар', 'Улаан баатар', 'УБ'] },
    { category: 'Газарзүй', difficulty: 1, question: 'Монгол Улс хоёрхон улстай хиллэдэг.', answer: 'үнэн', explanation: 'ОХУ, БНХАУ.' },
    { category: 'Газарзүй', difficulty: 1, question: 'Дэлхийн хамгийн том далай аль вэ?', options: ['Атлантын далай', 'Энэтхэгийн далай', 'Номхон далай', 'Хойд мөсөн далай'], answer: 'C' },
    { category: 'Газарзүй', difficulty: 1, question: 'Хамгийн том тив аль нь вэ?', options: ['Африк', 'Ази', 'Хойд Америк', 'Антарктид'], answer: 'Ази' },
    { category: 'Газарзүй', difficulty: 2, question: 'Монголын хамгийн өндөр оргил аль вэ?', options: ['Отгонтэнгэр', 'Сутай хайрхан', 'Хүйтэн оргил', 'Мөнххайрхан'], answer: 'Хүйтэн оргил', explanation: 'Алтай Таван Богдын Хүйтэн оргил 4374 м.' },
    { category: 'Газарзүй', difficulty: 2, question: 'Талбайгаараа Монголын хамгийн том нуур аль вэ?', options: ['Хөвсгөл', 'Увс', 'Хяргас', 'Буйр'], answer: 'Увс' },
    { category: 'Газарзүй', difficulty: 2, question: 'Австралийн нийслэл аль хот вэ?', options: ['Сидней', 'Мельбурн', 'Канберра', 'Перт'], answer: 'Канберра' },
    { category: 'Газарзүй', difficulty: 2, question: 'Говь цөл аль улсуудын нутагт оршдог вэ? (бүгдийг сонго)', options: ['Монгол', 'Хятад', 'Казахстан', 'Орос'], answer: ['Монгол', 'Хятад'] },
    { category: 'Газарзүй', difficulty: 3, question: 'Дэлхийн хамгийн том халуун цөл аль вэ?', options: ['Говь', 'Сахар', 'Калахари', 'Арабын цөл'], answer: 'Сахар' },

    // ---- Шинжлэх ухаан ----
    { category: 'Шинжлэх ухаан', difficulty: 1, question: 'Усны химийн томьёо юу вэ?', type: 'text', answer: ['H2O', 'H₂O'] },
    { category: 'Шинжлэх ухаан', difficulty: 1, question: 'Нар бол од юм.', answer: true },
    { category: 'Шинжлэх ухаан', difficulty: 1, question: 'Нарны аймагт хэдэн гариг байдаг вэ?', options: ['7', '8', '9', '10'], answer: '8' },
    { category: 'Шинжлэх ухаан', difficulty: 2, question: 'Дуу авиа вакуумд тархдаг.', answer: false, explanation: 'Дуу авиа тархахад орчин (агаар, ус, хатуу биет) шаардлагатай.' },
    { category: 'Шинжлэх ухаан', difficulty: 2, question: 'Алтны химийн тэмдэг юу вэ?', options: ['Ag', 'Al', 'Au', 'At'], answer: 'Au' },
    { category: 'Шинжлэх ухаан', difficulty: 2, question: 'Хүний биеийн хамгийн том эрхтэн аль вэ?', options: ['Элэг', 'Арьс', 'Тархи', 'Уушиг'], answer: 'Арьс' },
    { category: 'Шинжлэх ухаан', difficulty: 2, question: 'Дараахаас аль нь хөхтөн амьтан бэ? (бүгдийг сонго)', options: ['Халим', 'Сарьсан багваахай', 'Акул', 'Хэрээ'], answer: ['Халим', 'Сарьсан багваахай'] },
    { category: 'Шинжлэх ухаан', difficulty: 2, question: 'Нарны аймгийн хамгийн жижиг гариг аль вэ?', options: ['Буд', 'Ангараг', 'Сугар', 'Плутон'], answer: 'Буд' },
    { category: 'Шинжлэх ухаан', difficulty: 3, question: 'Аль нь анхны тоо вэ? (бүгдийг сонго)', options: ['2', '9', '11', '15', '17'], answer: ['2', '11', '17'] },
    { category: 'Шинжлэх ухаан', difficulty: 3, question: 'Вакуум дахь гэрлийн хурд ойролцоогоор хэд вэ?', options: ['30 000 км/с', '300 000 км/с', '3 000 000 км/с', '340 м/с'], answer: '300 000 км/с' },

    // ---- Технологи ----
    { category: 'Технологи', difficulty: 1, question: '1 байт хэдэн биттэй тэнцүү вэ?', options: ['4', '8', '16', '32'], answer: '8' },
    { category: 'Технологи', difficulty: 1, question: 'CPU гэдэг товчлолын утга аль вэ?', options: ['Central Processing Unit', 'Computer Power Unit', 'Core Program Utility', 'Central Program Unit'], answer: 0 },
    { category: 'Технологи', difficulty: 1, question: 'HTML нь програмчлалын хэл биш, тэмдэглэгээний (markup) хэл юм.', answer: true },
    { category: 'Технологи', difficulty: 2, question: 'Аль нь програмчлалын хэл вэ? (бүгдийг сонго)', options: ['Python', 'HTML', 'Java', 'CSS'], answer: ['Python', 'Java'] },
    { category: 'Технологи', difficulty: 2, question: 'Git-ийг анх бүтээсэн хүн хэн бэ?', options: ['Билл Гейтс', 'Линус Торвальдс', 'Гвидо ван Россум', 'Марк Цукерберг'], answer: 'Линус Торвальдс' },
    { category: 'Технологи', difficulty: 3, question: 'JavaScript дээр `typeof null` юу буцаадаг вэ?', options: ['"null"', '"undefined"', '"object"', '"number"'], answer: '"object"' },
    { category: 'Технологи', difficulty: 3, question: 'HTTP-ийн 404 статус код юуг илэрхийлдэг вэ?', options: ['Серверийн алдаа', 'Хуудас олдсонгүй', 'Хандах эрхгүй', 'Амжилттай'], answer: 'Хуудас олдсонгүй' },

    // ---- Ерөнхий ----
    { category: 'Ерөнхий', difficulty: 1, question: 'Шатрын хөлөг хэдэн нүдтэй вэ?', type: 'text', answer: ['64'] },
    { category: 'Ерөнхий', difficulty: 1, question: 'Эрийн гурван наадамд аль нь багтдаг вэ? (бүгдийг сонго)', options: ['Бөх', 'Морин уралдаан', 'Сур харваа', 'Шагай харваа'], answer: ['Бөх', 'Морин уралдаан', 'Сур харваа'] },
    { category: 'Ерөнхий', difficulty: 1, question: 'Хуурай газрын хамгийн хурдан амьтан аль вэ?', options: ['Арслан', 'Ирвэс', 'Гепард', 'Зээр'], answer: 'Гепард' },
    { category: 'Ерөнхий', difficulty: 2, question: '"Мона Лиза" зургийг хэн зурсан бэ?', options: ['Микеланджело', 'Леонардо да Винчи', 'Рафаэль', 'Ван Гог'], answer: 'Леонардо да Винчи' },
    { category: 'Ерөнхий', difficulty: 2, question: 'Зуны олимпын наадам хэдэн жил тутам болдог вэ?', options: ['2', '3', '4', '5'], answer: '4' },
    { category: 'Ерөнхий', difficulty: 3, question: 'Дэлхийн хамгийн өндөр оргил Эверест ойролцоогоор хэдэн метр өндөр вэ?', options: ['7 820 м', '8 611 м', '8 849 м', '9 120 м'], answer: '8 849 м' },
  ],
};
