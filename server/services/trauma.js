const RESPONSES = {
  parents: [
    "Ah yes, parents. In my country we say: the apple does not fall far from tree, but sometimes tree is on fire. You will be fine. Probably.",
    "Your parents, they mess you up good, yes? In Eastern Europe we call this 'Tuesday'. Next patient please.",
    "Hmm, parent issues. Very original. I have not heard this one since... *checks watch* ...five minutes ago.",
  ],
  abandonment: [
    "Someone left you? Good. Now you learn to be strong like bear. Bear does not cry when other bear leaves den. Bear eats fish and moves on.",
    "Abandonment, yes. In my village, everyone gets abandoned at least once before age of ten. Builds character. You are welcome.",
    "Left behind? At least you were noticed enough to be left. Some of us were simply... overlooked. Like potato in back of cupboard.",
  ],
  school: [
    "School trauma? My school was in building with no roof. We learned mathematics in rain. Your problems are luxury problems, my friend.",
    "Bullied at school, yes? In my country, the bullies become politicians. At least your bullies peaked in gymnasium.",
    "School was hard? Try learning algebra when wolves are circling the schoolyard. I am not making joke. This was my Tuesday.",
  ],
  siblings: [
    "Sibling problems. Classic. My brother sold my shoes for turnips. I walked barefoot for three winters. But sure, your sister was 'mean'.",
    "Your siblings tormented you? This is how siblings show love where I am from. You should be grateful they noticed you at all.",
    "Ah, the sibling rivalry. In my family, there were nine children and one bicycle. You learn quick or you walk. I walked.",
  ],
  poverty: [
    "You think you know poverty? My family shared one potato between twelve people. On good day. On bad day, we shared the memory of potato.",
    "Money problems in childhood, yes? Welcome to club. The club has no building because we cannot afford building. But the club is strong.",
    "Poverty trauma. I understand this deeply. But also, suffering builds soul. Your soul is probably very well-built by now. Congratulations.",
  ],
  emotional: [
    "Emotional neglect. The invisible wound. In my country we do not even have word for this because nobody talks about feelings. Problem solved.",
    "Nobody showed you love? In Eastern Europe, love is when your grandmother hits you with wooden spoon but then makes you soup. Very complicated.",
    "Emotions were not allowed in your house? Same in mine. We expressed feelings through aggressive bread-making. Very therapeutic. Try it.",
  ],
  nothing: [
    "You say 'nothing'? The biggest trauma of all - the denial. You are carrying entire abandoned building on your back and calling it 'nothing'. Impressive.",
    "'Nothing happened to me.' This is what they all say. Then three hours later, we are talking about incident with the garden hose in 1997.",
    "Ah, denial. My favorite patient. You come to trauma chat and say you have no trauma. This is like going to dentist and saying you have no teeth. I can see the teeth. I can see the trauma.",
  ],
  default: [
    "Interesting. Very interesting. In my professional opinion... you are mess. But beautiful mess, like abstract painting nobody wants to buy.",
    "I have heard many traumas in my career. Yours is... *shuffles papers* ...definitely one of them. That is all I will say.",
    "Mmm yes. This explains much. Also explains nothing. But in therapy, these are often same thing. That will be 200 dollars. I accept also potatoes.",
    "You know, in my country there is saying: 'Every person is broken vase glued back together.' Some vases are more glue than vase. You are mostly glue. But nice glue.",
    "This is what we call in professional terms: 'big yikes'. But do not worry. Everybody here has big yikes. You are among friends. Broken, traumatized friends.",
  ],
};

const KEYWORDS = [
  { key: 'parents', patterns: ['parent', 'mom', 'dad', 'mother', 'father', 'mama', 'papa'] },
  { key: 'abandonment', patterns: ['abandon', 'left me', 'left us', 'walked out', 'disappeared', 'alone', 'lonely'] },
  { key: 'school', patterns: ['school', 'bully', 'bullied', 'teacher', 'class', 'grade', 'homework'] },
  { key: 'siblings', patterns: ['sibling', 'brother', 'sister', 'twin', 'older', 'younger'] },
  { key: 'poverty', patterns: ['poor', 'poverty', 'money', 'afford', 'hungry', 'broke', 'welfare'] },
  { key: 'emotional', patterns: ['emotion', 'neglect', 'ignore', 'feeling', 'love', 'affection', 'cold', 'distant'] },
  { key: 'nothing', patterns: ['nothing', 'none', 'fine', 'normal', 'no trauma', 'good childhood', "don't have", "didn't have", 'n/a'] },
];

function getTraumaResponse(trauma) {
  const lower = trauma.toLowerCase();

  for (const { key, patterns } of KEYWORDS) {
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        const responses = RESPONSES[key];
        return responses[Math.floor(Math.random() * responses.length)];
      }
    }
  }

  const defaults = RESPONSES.default;
  return defaults[Math.floor(Math.random() * defaults.length)];
}

module.exports = { getTraumaResponse };
