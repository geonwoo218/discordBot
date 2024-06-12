require('dotenv').config();
const { Client, GatewayIntentBits,
    ModalBuilder, TextInputBuilder, ActionRowBuilder, TextInputStyle,
    InteractionType,
    Constants } = require('discord.js');
const res = require('express/lib/response');
const TOKEN = process.env.botapi;
const mysql = require('mysql2');
const connection = mysql.createConnection({ //데이터베이스 연결
    host: 'localhost',
    user: 'dicoAdmin',
    password: '12341234!!',
    database: 'discordbot',
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
    ],
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
});


client.on('interactionCreate', async interaction => { //명령어 실행
    if (!interaction.isChatInputCommand()) return;

    var command = interaction.commandName;
    var member = interaction.user;

    let isThread = interaction.channel?.type === 'GUILD_PUBLIC_THREAD';

    if (isThread) { // 스레드 내에서 실행되는 명령어 처리
        if (command === '준비') {
            ready(member.id, interaction);
        } else if (command === '게임시작') {
            startGame(member.id, interaction);
        } else {
            // 스레드 내에서 실행되는 다른 명령어 처리
            interaction.reply("해당 명령어는 스레드 내에서 실행할 수 없습니다.");
        }
    } else {
        if (command == '가입하기') {
            addUser(member, interaction);
        }
        checkUser(member, interaction)
            .then((chUser) => {
                if (chUser) {
                    if (!interaction.inThread) {
                        if (command == '방생성') {
                            CreateRoomCode() //코드 생성 후 
                                .then((roomCode) => {
                                    addRoom(roomCode, interaction); //방 생성
                                })
                                .catch((err) => {
                                    console.error(err);
                                    interaction.reply("방 생성 오류: 방 코드 생성 중 오류 발생");
                                });
                        }
                        if (command == '방참가') {
                            var userRoomCode = interaction.options.getString('방코드');
                            joinRoom(userRoomCode, interaction);
                        }
                        if (command == '방나가기') {
                            exitRoom(member.id, interaction);
                        }
                        if (command === '탈퇴하기') {
                            exitUser(interaction);
                        }
                        if(command == '준비' || command == '게임시작'){
                            interaction.reply("먼저 방을 참가해주세요");
                        }
                    }
                } else {
                    interaction.reply("가입 후 이용 가능한 명령어입니다.");
                    return;
                }
            })
            .catch((err) => {
                console.error(err);
                interaction.reply("명령어 실행 중 오류 발생");
            });
    }

});


//가입하기
function addUser(member, interaction) {
    console.log("유저가입 함수 시작")
    connection.query(
        "INSERT INTO user (userId,userName) VALUES(?,?)",
        [member.id, member.displayName],
        function (err, results) {
            if (err) {
                interaction.reply("이미 가입되었잖아요");
                console.log("유저가입 에러: " + err);
                return;
            }
            interaction.reply("가입을 완료했어요.");
            console.log("유저가입 성공");
            return;
        })
}
//탈퇴하기
function exitUser(member, interaction) {
    console.log("유저탈퇴 함수 시작")
    connection.query(
        "DELETE FROM USER WHERE = userId = ?",
        [member.id],
        function (err, results) {
            if (err) {
                //interaction.reply("이미 탈퇴된 유저입니다.");
                console.log("유저가입 에러: " + err);
                return;
            }
            interaction.reply("수고");
            console.log("유저탈퇴 성공");
            return;
        })
}
//가입여부확인
function checkUser(member, interaction) {
    return new Promise((resolve, reject) => {
        console.log("유저 확인 함수 시작");
        // 유저가 가입되어 있는지 데이터베이스에서 확인
        connection.query(
            "SELECT * FROM user WHERE userId = ?",
            [member.id],
            function (err, results) {
                if (err) {
                    interaction.reply("유저 확인 중 오류가 발생");
                    console.log("유저 확인 쿼리 에러: " + err);
                    reject(err);
                    return;
                }

                // 결과가 없으면 유저가 가입되어 있지 않음을 응답
                if (results.length === 0) {
                    resolve(false);
                }
                console.log("유저 확인 성공");
                resolve(true);
            }
        );
    });
}
//방생성
async function addRoom(roomCode, interaction) {
    console.log("방생성 함수 시작");
    checkUserJoinRoom(interaction.user.id)
        .then((canJoin) => {
            if (canJoin) {
                var roomName = interaction.options.getString('방이름');
                var roomDisclosure = interaction.options.getBoolean('공개여부');
                var userId = interaction.user.id;
                var userName = interaction.user.displayName;
                var roomDisclosureValue = roomDisclosure ? 1 : 0;

                connection.query(
                    "INSERT INTO ROOM(roomName, roomCode, roomDisclosure) VALUES(?,?,?)",
                    [roomName, roomCode, roomDisclosureValue],
                    async function (err, results) {
                        if (err) {
                            interaction.reply("방생성 에러");
                            console.log("방 생성 쿼리 에러: " + err);
                            return;
                        }
                        connection.query(
                            'INSERT INTO joinuserlist VALUES(?,?,?,?)',
                            [userId, userName, roomCode, roomName],
                            (err) => {
                                if (err) {
                                    console.log("joinuserlist 업데이트에러: " + err);
                                    interaction.reply("방생성 오류 발생");
                                    return;
                                }
                            });
                        connection.query(
                            'INSERT INTO gameboard (gameCode) values(?)',
                            [roomCode],
                            (err) => {
                                if (err) {
                                    console.log('insert gameboard에러: ' + err);
                                    interaction.reply("방생성 오류 발생");
                                    return;
                                }
                            }
                        )
                        // 방 생성 성공 메시지를 보내고, 공개 여부에 따라 방 코드를 보여줌
                        let responseMessage = roomName + ' 방이 생성 되었습니다.';
                        const title = roomName;
                        let thread = await interaction.channel.threads.create({
                            name: title,
                            autoArchiveDuration: 60,
                            type: 12,
                        });
                        if (roomDisclosureValue) {
                            responseMessage += '\n방 코드: ' + roomCode;

                        } else {
                            await interaction.user.send("방 코드: " + roomCode); // 비공개 방에서는 DM으로 방 코드를 전송
                        }
                        //thread.send(responseMessage);
                        //{ content: responseMessage, ephemeral: true }
                        thread.send(`<@${interaction.user.id}>님이 방을 생성했습니다.`);
                        await interaction.reply({ content: responseMessage });
                        console.log("방생성 성공");

                        return;
                    }
                )
            } else {
                interaction.reply('이미 다른 방에 참가되어있습니다.');
                console.log('방 중복 참가');
                return;
            }
        })
};
// 4자리 무작위 문자열 생성 함수
function CreateRoomCode() {
    console.log("방코드생성 함수 시작");
    return new Promise((resolve, reject) => {

        var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        var codeLength = 4;
        var code = '';

        for (var i = 0; i < codeLength; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }

        code = '#' + code;

        connection.query(
            'SELECT * FROM ROOM WHERE roomCode = ?',
            [code],
            function (err, results) {
                if (err) {
                    console.log("방코드검색에러발생: " + err);
                    reject(err);
                    return;
                }

                if (results.length > 0) { //방 코드 중복 발생
                    console.log("방코드 중복발생 ");
                    resolve(CreateRoomCode());
                } else {
                    console.log("방코드 생성 성공");
                    resolve(code);
                }
            }
        );
    });
}
//방참가
function joinRoom(roomCode, interaction) {
    console.log('방참가함수 시작');

    checkUserJoinRoom(interaction.user.id)
        .then((canJoin) => {
            if (canJoin) {
                connection.query(
                    'SELECT roomCode,roomName FROM room WHERE roomCode = ?',
                    [roomCode],
                    (error, results) => {
                        if (error) {
                            console.log('방참가 에러: ', error);
                            interaction.reply("방 참가 중 오류가 발생했습니다.");
                            return;
                        }

                        if (results.length === 0) { //검색 결과가 없을때
                            interaction.reply("유효하지 않은 방 코드입니다.");
                            return;
                        }

                        var room = results[0];
                        var roomName = room.roomName;
                        var userId = interaction.user.id;
                        var userName = interaction.user.displayName;

                        connection.query(
                            'INSERT INTO joinuserlist VALUES(?,?,?,?)',
                            [userId, userName, roomCode, roomName],
                            (err) => {
                                if (err) {
                                    console.log("joinuserlist 업데이트에러: " + err);
                                    interaction.reply("방참가 오류 발생");
                                    return;
                                }
                                interaction.reply(userName + '님이 ' + roomName + '방에 참가했습니다.');

                                console.log('방참가 성공')
                                // 참가한 사용자에게 메시지를 보내는 부분 추가
                                let thread = interaction.channel.threads.cache.find(thread => thread.name === roomName);
                                if (thread) {
                                    thread.send(`<@${interaction.user.id}>님이 방에 참가하였습니다.`);
                                } else {
                                    interaction.reply('방이 없습니다.');
                                    console.log("쓰레드를 찾을 수 없습니다.");
                                }
                            }
                        )
                    });
            } else {
                interaction.reply('이미 다른 방에 참가되어있습니다.');
                console.log('방 중복 참가');
                return;
            }
        })

}
//방 참가 가능 체크
function checkUserJoinRoom(userId) {
    console.log("checkUserJoinRoom start")
    return new Promise((resolve, reject) => {
        connection.query(
            'select userId from joinuserlist where userId = ?',
            [userId],
            (error, results) => {
                if (error) {
                    console.log('방 중복참가체크 에러: ' + error);
                    reject(error);
                    return;
                }

                if (results.length === 0) {
                    console.log('참가 가능');
                    resolve(true);
                } else {
                    console.log('참가 불가능');
                    resolve(false);
                }
            }
        )
    })
}
//방 나가기 가능 체크
function canExitRoom(userId) {
    console.log("canExitRoom start");
    return new Promise((resolve, reject) => {
        connection.query(
            'SELECT * FROM joinuserlist WHERE userId = ?',
            [userId],
            (err, results) => {
                if (err) {
                    console.log("exitRoomError: " + err);
                    reject(err);
                    return;
                }
                if (results.length === 0) {
                    console.log('퇴장불가능');
                    resolve({ canExit: false });
                } else {
                    console.log('퇴장가능');
                    const userName = results[0].userName; // 변수명을 올바르게 변경합니다.
                    const roomName = results[0].roomName; // 변수명을 올바르게 변경합니다.
                    resolve({ canExit: true, userName, roomName });
                }

            }
        )
    })
}
//방 나가기
async function exitRoom(userId, interaction) {
    console.log("방나가기 함수 시작");
    canExitRoom(userId)
        .then(async ({ canExit, userName, roomName }) => {
            if (canExit) {
                connection.query(
                    'DELETE FROM joinuserlist WHERE userId = ?',
                    [userId],
                    async (err) => {
                        if (err) {
                            console.log('방 나가기 에러: ' + err);
                            interaction.reply("방 나가기 중 오류가 발생했습니다.");
                            return;
                        }
                        // 성공적으로 방에서 나갔을 때
                        interaction.reply('방을 나갔습니다.');
                        console.log('데이터베이스에서 방 나가기 성공');
                    });
                // 쓰레드에서 사용자를 나가기
                let ExitThread = interaction.channel.threads.cache.find(th => th.name == roomName);
                if (ExitThread) {
                    await ExitThread.members.remove(userId);
                    console.log(`사용자 ${userName}가 쓰레드를 나갔습니다.`);
                } else {
                    console.log('쓰레드를 찾을 수 없습니다.');
                }

            } else {
                interaction.reply("참가한 방이 없습니다.");
            }
        })
        .catch(err => {
            console.error("방 나가기 가능 체크 중 에러: ", err);
            interaction.reply("방 나가기 가능 체크 중 오류가 발생했습니다.");
        });
}
//게임준비
function ready(userId, interaction) {
    //유저테이블 역할 초기화
    initializeGameRoom(userId, interaction)
        .then(() => {
            interaction.reply(interaction.displayName + "님 준비완료");
        }).catch(err => {
            interaction.reply('준비중 오류발생');
            console.log("readyErr: " + err);
        })
};


//게임 초기화
function initializeGameRoom(userId, interaction) {
    return new Promise((resolve, reject) => {
        connection.query(
            'UPDATE user SET userRole = "", vote = 0, ready = 1 where userId = ?',
            [userId],
            (err) => {
                if (err) {
                    interaction.reply("게임 준비중 오류발생");
                    reject(err);
                }

                resolve();
            }
        )
    })
}
//게임시작
function startGame(userId, interaction) {
    // 유저가 모두 준비했는지 확인
    checkUserReady(userId)
        .then(({ allReady, notReadyUser }) => {
            if (allReady) {
                interaction.reply("게임을 시작합니다.");
                interaction.reply("역할을 정하는 중입니다.");

                setRole() //역할 정하기
                    .then((players) => {
                        players.forEach(player => {
                            // 플레이어에게 DM을 보냅니다.
                            let message = `당신의 역할은 ${player.role} 입니다.`;
                            if (player.role === 'mafia') {
                                let otherMafias = players.filter(p => p.role === 'mafia' && p.userId !== player.userId);
                                if (otherMafias.length > 0) {
                                    message += `\n당신의 동료 마피아: ${otherMafias.map(mafia => mafia.userName).join(", ")}`;
                                }
                            }
                            const user = client.users.cache.get(player.userId);
                            if (user) {
                                user.send(message);
                            } else {
                                console.log(`유저를 찾을 수 없습니다: ${player.userId}`);
                            }
                        })
                    });
                // 게임 시작 로직 추가
            } else {
                interaction.reply(notReadyUser.join(", ") + " 사용자가 준비하지 않았습니다.");
            }
        })
        .catch(err => {
            interaction.reply('시작중 오류발생');
            console.log('startErr: ' + err);
        });
}
//모든 유저가 준비했는지
function checkUserReady(userId) {
    return new Promise((resolve, reject) => {
        getUserList(userId)
            .then((players) => {
                let allReady = true;
                let notReadyUser = [];

                for (let i = 0; i < players.length; i++) {
                    if (players[i].ready !== 1) {
                        allReady = false;
                        notReadyUser.push(players[i].userName);
                    }
                }

                if (allReady) {
                    resolve({ allReady: true });
                } else {
                    resolve({ allReady: false, notReadyUser: notReadyUser });
                }
            })
            .catch((err) => {
                reject(err);
            });
    })
}
//역할 정하기
function setRole(userId) {
    return new Promise((resolve, reject) => {
        getUserList(userId)
            .then((players) => {
                if (players.length < 4) {
                    resolve('사람이 너무 적습니다.');
                    return;
                }

                // 게임의 인원 수에 따라 시민과 마피아의 수를 결정합니다.
                let numCitizens = 3;
                let numMafias = 1;
                if (players.length >= 6) {
                    numMafias = 2;
                }

                // 역할을 할당하기 위해 플레이어를 무작위로 섞습니다.
                players.sort(() => Math.random() - 0.5);

                // 시민과 마피아에게 역할을 할당합니다.
                for (let i = 0; i < players.length; i++) {
                    if (i < numMafias) {
                        // 마피아 역할 할당
                        players[i].role = 'mafia';
                    } else {
                        // 시민 역할 할당
                        players[i].role = 'citizen';
                    }

                    // 할당한 역할을 데이터베이스에 업데이트합니다.
                    connection.query(
                        'UPDATE user SET userRole = ? WHERE userId = ?',
                        [players[i].role, players[i].userId],
                        (err, result) => {
                            if (err) {
                                reject(err);
                            }
                        }
                    );
                }

                resolve(players);
            })
            .catch((err) => {
                reject(err);
            });
    })
}
//게임유저 정보
function getUserList(userId) {
    return new Promise((resolve, reject) => {
        connection.query(
            'select * from joinuserlist where userId = ?', //룸 코드 가져오기
            [userId],
            (err, results) => {
                if (err) {
                    reject(err);
                }
                if (results.length === 0) {
                    resolve([]); // 결과가 없는 경우 빈 배열을 반환
                    return;
                }
                let roomCode = results[0].roomCode;
                connection.query(
                    `SELECT *
                    FROM discordbot.user AS u
                    INNER JOIN discordbot.joinuserlist AS j ON u.userId = j.userId
                    WHERE j.roomCode = ?`,
                    [roomCode],
                    (err, results) => {
                        if (err) {
                            reject(err);
                        }
                        let players = results;
                        resolve(players);
                    }
                )
            })
    })
}

client.login(TOKEN);


// https://discordjs.dev/docs/packages/discord.js/14.14.1/CommandInteraction:Class#awaitModalSubmit

// https://discordjs.dev/docs/packages/discord.js/14.14.1/ModalSubmitInteraction:Class#fields
// https://discordjs.dev/docs/packages/discord.js/14.14.1/ModalSubmitFields:Class#getTextInputValue

/*
const modal = new ModalBuilder().setCustomId('createThread').setTitle('새로운 스레드 생성');
const titleInput = new TextInputBuilder().setCustomId('titleInput').setLabel('여기에 스레드 방제목을 입력하세요').setStyle(TextInputStyle.Short);
const titleActionRow = new ActionRowBuilder().addComponents([titleInput]);
modal.addComponents([titleActionRow]);
await interaction.showModal(modal);
*/