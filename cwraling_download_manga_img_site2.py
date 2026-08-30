
import time
import requests
from bs4 import BeautifulSoup
import os
import re

import subprocess
import os



#siteURL = 'https://11toon146.com'
siteURL = 'http://103.204.13.68:8905'

title = "슈퍼 뒤에서 담배 피우는 두 사람"
toonID = 34978
num = 0
downPath = f'C:/Users\jiyeu\OneDrive\바탕 화면\만화/{title}/'

zipdest = f'C:/Users\jiyeu\OneDrive\바탕 화면\만화/{title}.zip'
zipsource = downPath


linkList = f"{siteURL}/bbs/board.php?bo_table=toons&is={toonID}"
linkDtl = f'{siteURL}/bbs/board.php?bo_table=toons&stx=GTO&is={toonID}'  # &wr_id={aa[1]}
download_site_header = {'Referer': '103.204.13.68:8905', 'user-agent' : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36'}


def runZip( dest, source):
    program = 'C:\Program Files\Bandizip\Bandizip.exe'  # 반디집 설치 위치 (Default)
    print("zipping")
    subprocess.run([program, 'c', '-y', dest, source])

def getID(str):
    pos_s = str.find('wr_id=')
    pos_e = str.find('&stx')

    return re.sub(r'[^0-9]', '', str[pos_s:pos_e])


def getPostID(pageNo):
    postIdList = []
    download_site = f"{linkList}&page={pageNo}"
    source = requests.get(download_site,headers=download_site_header).text
    soup = BeautifulSoup(source, 'html.parser')
    elem_list = soup.select('button.episode.is-series')

    for e in elem_list:
        postIdList.append( {"title":e.select_one("div.episode-title.ellipsis").text , "id":getID(e["onclick"])})

    return postIdList


def getImageList(title, id):

    time.sleep(0.2)
    imageList =''
    download_site = f'{linkDtl}&wr_id={id}'
    source = requests.get(download_site,headers=download_site_header).text
    soup = BeautifulSoup(source, 'html.parser')
    elem_list = soup.select('script')
    s = str(elem_list)

    for i,a in enumerate(s.splitlines()):
        if "var img_list = [" in a:
            imageList = a.replace('    var img_list = [','').replace(']','').replace('"','').replace(';','').replace('//www','https://www').split(',')



    return imageList



def download( savePath, fileName,url):
    filePath = f"{savePath}{fileName}.jpg"
    if not os.path.exists(filePath) or ( os.path.exists(filePath) and os.path.getsize(filePath) <= 4096 ) :
        with open(filePath, "wb") as file:  # open in binary mode
            try:
                response = requests.get(url  ,timeout = 5,headers=download_site_header)  # get request
                file.write(response.content)  # write to file
            except:
                download( savePath, fileName,url)


def main(pageno):

    boradList = getPostID(pageno)
    if len(boradList) == 0 :
        print("파일없음")
    else:
        for i, a in enumerate(reversed (boradList)):
            num = num + 1
            file_folder = a["title"]
            file_folder = file_folder.replace("?","").replace(":","")

            downPath2 = f'{downPath}{str(num).zfill(2)}_{file_folder}/'

            if not os.path.exists(downPath2):
                os.makedirs(downPath2)

            imgList =getImageList(a["title"], a["id"])
            print(f"{a['title']} : {imgList}")
            for i, aa in enumerate(imgList):
                download(downPath2, f"{str(num).zfill(2)}_{file_folder}_{ str(i+1).zfill(3)}",aa )


def main2(pageno,num):

    boradList = getPostID(pageno)
    if len(boradList) == 0:
        print("파일없음")
    else:
        for i, a in enumerate(reversed(boradList)):
            num = num + 1
            file_folder = a["title"]
            file_folder = file_folder.replace("?", "").replace(":", "")

            if not os.path.exists(downPath):
                os.makedirs(downPath)

            imgList = getImageList(a["title"], a["id"])
            print(f"{str(num)} - {a['title']} : {imgList}")
            for i, aa in enumerate(imgList):
                download(downPath, f"{str(num).zfill(3)}_{str(i + 1).zfill(3)}", aa)
    return num


#main(2)

num = main2(5,num)
num = main2(4,num)
num = main2(3,num)
num = main2(2,num)
num = main2(1,num)

runZip (zipdest , zipsource)

# 즉시 PC 종료
#os.system("shutdown /s /t 0")




#
# if __name__ == '__main__':
#     pool =  Pool(4)
#     pool.map(main, [1,2])
#
