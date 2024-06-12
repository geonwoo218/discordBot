require('dotenv').config();
const { REST, Routes } = require('discord.js');
const { type } = require('express/lib/response');
const TOKEN = process.env.botapi;
const CLIENT_ID = process.env.clientapi;

const commands = [
  {
    name: '가입하기',
    description: '유저 정보 등록',
  },
  {
    name: '방생성',
    description: '게임 방을 생성',
    
    options: [
      {
        name: '방이름',
        description: '방의 이름 설정',
        type: 3,
        required: true,
      },
      {
        name: '공개여부',
        description: '방의 공개여부 결정',
        type: 5,
        required: true,
        choice: [
          {
            name: '공개',
            description: '공개방 생성',
            value: true,
          },
          {
            name: '비공개',
            description: '비공개방 생성',
            value: false,
          }

        ]
      }
    ]
    
  },
  {
    name: '방참가',
    description: '방에 참가',
    options: [
      {
        name: '방코드',
        description: '방의 코드를 입력',
        type: 3,
        required: true,
      }
    ]
  },
  {
    name: '방나가기',
    description: '참가하고 있는 방을 나갑니다.',
  },
  {
    name: '준비',
    description: '게임 시작을 위한 준비를 합니다.',
  },
  {
    name: '게임시작',
    description: '게임을 시작합니다.',
  },
  {
    name: '탈퇴하기',
    description: '탈퇴',
  },
];

const rest = new REST({ version: '10' }).setToken(TOKEN);

async function loadSlashCommands() {
  try {
    console.log('slash command 로딩중..');

    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });  //number : clientId

    console.log('리로딩 완료.');
  } catch (error) {
    console.error(error);
  }
}

loadSlashCommands();